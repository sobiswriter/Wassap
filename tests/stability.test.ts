import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import { runInNewContext } from 'node:vm';
import { enqueuePendingMessage, retryExpired } from '../utils/offlineQueue';
import { notificationConversation } from '../utils/notificationText';
import { getGeminiResponse } from '../services/geminiService';

test('durable foreground generation rejects unavailable replies instead of inventing successful messages', async () => {
  const transport = mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ error: 'Unavailable' }), { status: 400, headers: { 'Content-Type': 'application/json' } }));
  try {
    await assert.rejects(getGeminiResponse({ name: 'Maya' }, [{ text: 'Hi', sender: 'me' }], undefined, undefined, { aiProvider: 'vertex', isVertexUnlocked: true } as any, undefined, false, undefined, undefined, true), /REPLY_UNAVAILABLE/);
  } finally { transport.mock.restore(); }
});

test('outbox enqueue resolves only when its transaction commits', async () => {
  const previous = globalThis.indexedDB;
  let transaction: any; let settled = false;
  const db = { close() {}, transaction: () => transaction = { objectStore: () => ({ put() {} }) } };
  globalThis.indexedDB = { open: () => { const request: any = { result: db }; queueMicrotask(() => request.onsuccess()); return request; } } as any;
  try {
    const pending = enqueuePendingMessage('chat', { id: 'message' } as any).then(() => { settled = true; });
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(settled, false);
    transaction.oncomplete(); await pending; assert.equal(settled, true);
  } finally { globalThis.indexedDB = previous; }
});

function workerFixture() {
  const stores = new Map<string, Map<string, any>>([['pending_outbox', new Map()], ['synced_background', new Map()]]);
  const notifications: any[] = []; let requests = 0; let online = false; const events: Record<string, Function> = {};
  const db: any = { close() {}, transaction(name: string) {
    const tx: any = { objectStore: (storeName = name) => ({
      put(item: any) { stores.get(storeName)!.set(item.id, structuredClone(item)); queueMicrotask(() => tx.oncomplete?.()); },
      delete(id: string) { stores.get(storeName)!.delete(id); queueMicrotask(() => tx.oncomplete?.()); },
      get(id: string) { const req: any = {}; queueMicrotask(() => { req.result = stores.get(storeName)!.get(id); req.onsuccess?.(); queueMicrotask(() => tx.oncomplete?.()); }); return req; },
      getAll() { const req: any = {}; queueMicrotask(() => { req.result = [...stores.get(storeName)!.values()]; req.onsuccess?.(); }); return req; }
    }) }; return tx;
  } };
  const context: any = { console, URL, Date, Math, Promise, AbortController, setTimeout, clearTimeout, crypto,
    structuredClone, clients: { matchAll: async () => [] },
    indexedDB: { open: () => { const request: any = { result: db }; queueMicrotask(() => request.onsuccess()); return request; } },
    fetch: async () => { requests++; if (!online) throw new TypeError('Network disconnected'); return { ok: true, json: async () => ({ text: 'An older fragment.\n\nHere is the newest reply.' }) }; },
    self: { addEventListener: (name: string, callback: Function) => events[name] = callback, registration: { showNotification: async (_title: string, options: any) => notifications.push(options), sync: { register: async () => {} } } }
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8') + '\nglobalThis.deliver = deliverNotificationReply;', context);
  return { stores, notifications, events, context, get requests() { return requests; }, reconnect: () => { online = true; } };
}

test('offline notification input is durable and retry saves the whole answer before showing the latest user/persona pair', async () => {
  const fixture = workerFixture(); let pending: Promise<any>;
  fixture.events.notificationclick({ reply: 'Keep this reply', action: 'reply', notification: { close() {}, title: 'Maya', tag: 'chat', data: { chatId: 'chat', chatName: 'Maya', chatAvatar: '/persona-test.png', provider: 'vertex' } }, waitUntil(promise: Promise<any>) { pending = promise; } });
  await pending!;
  const items = [...fixture.stores.get('pending_outbox')!.values()];
  assert.equal(items.length, 1); assert.equal(items[0].message.text, 'Keep this reply');
  assert.equal(items[0].leaseUntil, 0);
  assert.equal(fixture.stores.get('synced_background')!.size, 1);
  fixture.reconnect();
  await assert.rejects(fixture.context.deliver(items[0]), /backoff/);
  items[0].nextAttemptAt = 0; fixture.stores.get('pending_outbox')!.set(items[0].id, items[0]);
  await fixture.context.deliver(items[0]);
  assert.equal(fixture.stores.get('pending_outbox')!.size, 0);
  const saved = [...fixture.stores.get('synced_background')!.values()].find(item => item.personaReplies.length);
  assert.equal(saved.personaReplies.map((m: any) => m.text).join(' '), 'An older fragment. Here is the newest reply.');
  assert.equal(fixture.notifications.at(-1).body, 'Here is the newest reply.');
  assert.ok(!fixture.notifications.at(-1).body.includes('─'));
  assert.equal(fixture.notifications.at(-1).icon, '/persona-test.png');
  const count = fixture.notifications.length;
  await fixture.context.deliver(items[0]);
  assert.equal(fixture.notifications.length, count, 'Completed outbox item must not deliver twice');
});


test('retries expire at one minute or three attempts without expiring an unattempted offline send', () => {
  const item: any = { id: 'a', chatId: 'chat', queuedAt: 0, message: {} };
  assert.equal(retryExpired(item, 999999), false);
  assert.equal(retryExpired({ ...item, retryStartedAt: 1000, attempts: 2 }, 60999), false);
  assert.equal(retryExpired({ ...item, retryStartedAt: 1000, attempts: 2 }, 61000), true);
  assert.equal(retryExpired({ ...item, attempts: 3 }, 1000), true);
});

test('notifications contain only the latest persona reply and no user echo', () => {
  const user = 'A complete user message'; const persona = 'A complete persona reply';
  assert.equal(notificationConversation(user, persona), persona);
  assert.equal(notificationConversation('', persona), persona);
  assert.ok(readFileSync('public/sw.js', 'utf8').includes('return personaText;'));
});

test('expired background reply falls back once without making another model request', async () => {
  const fixture = workerFixture();
  const item = { id: 'expired', chatId: 'chat', queuedAt: 0, retryStartedAt: Date.now() - 60000, attempts: 2, message: { id: 'expired', text: 'Are you there?', sender: 'me' }, notificationData: { chatName: 'Maya', provider: 'vertex' } };
  fixture.stores.get('pending_outbox')!.set(item.id, item);
  await fixture.context.deliver(item);
  assert.equal(fixture.requests, 0);
  assert.equal(fixture.stores.get('pending_outbox')!.size, 0);
  const saved = [...fixture.stores.get('synced_background')!.values()][0];
  assert.ok(saved.personaReplies.length > 0);
  assert.ok(!fixture.notifications.at(-1).body.includes('You:'));
  await fixture.context.deliver(item);
  assert.equal(fixture.notifications.length, 1);
});


test('worker defers another persona while any call is active', async () => {
  const fixture = workerFixture();
  fixture.context.caches = { open: async () => ({ match: async () => ({ json: async () => ({ chatId: 'different-persona', expiresAt: Date.now() + 45000 }) }) }) };
  const item = { id: 'deferred', chatId: 'chat', message: { id: 'deferred', text: 'Hello', sender: 'me' }, notificationData: { chatName: 'Maya', provider: 'vertex' } };
  fixture.stores.get('pending_outbox')!.set(item.id, item);
  await fixture.context.deliver(item);
  assert.equal(fixture.requests, 0); assert.equal(fixture.stores.get('pending_outbox')!.size, 1);
});
