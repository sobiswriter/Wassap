import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test, mock } from 'node:test';
import { runInNewContext } from 'node:vm';
import { enqueuePendingMessage, retryExpired } from '../utils/offlineQueue';
import { notificationConversation } from '../utils/notificationText';
import { getGeminiResponse } from '../services/geminiService';
import { Models } from '@google/genai';

test('Cloud preserves a healthy 25-second generation rather than aborting at 20 seconds', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  let requests = 0;
  const transport = mock.method(globalThis, 'fetch', async (_url: any, options: any) => new Promise<Response>((resolve, reject) => {
    requests++;
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
    setTimeout(() => resolve(new Response(JSON.stringify({ text: 'Still here.' }), { headers: { 'Content-Type': 'application/json' } })), 25000);
  }));
  try {
    const reply = getGeminiResponse({ name: 'Maya' }, [{ text: 'Hi', sender: 'me' }], undefined, undefined, { aiProvider: 'vertex', isVertexUnlocked: true } as any, undefined, false, undefined, undefined, true).then(text => ({ text }), error => ({ error }));
    mock.timers.tick(25000);
    assert.deepEqual(await reply, { text: 'Still here.' });
    assert.equal(requests, 1);
  } finally { transport.mock.restore(); mock.timers.reset(); }
});

test('Studio chat also allows 40 seconds and preserves cancellation', async () => {
  const controller = new AbortController();
  const transport = mock.method(Models.prototype as any, 'generateContentInternal', async (args: any) => {
    assert.equal(args.config.httpOptions.timeout, 40000);
    assert.equal(args.config.abortSignal, controller.signal);
    return { text: 'Still here.' };
  });
  try {
    assert.equal(await getGeminiResponse({ name: 'Maya' }, [{ text: 'Hi', sender: 'me' }], undefined, undefined, { aiProvider: 'studio', apiKey: 'synthetic' } as any, undefined, false, undefined, controller.signal, true), 'Still here.');
  } finally { transport.mock.restore(); }
});

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

test('notification worker preserves a healthy 25-second Cloud response within its lease', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const fixture = workerFixture();
    let requests = 0;
    fixture.context.fetch = async (_url: any, options: any) => new Promise((resolve, reject) => {
      requests++;
      options.signal.addEventListener('abort', () => reject(new Error('Request aborted')), { once: true });
      setTimeout(() => resolve({ ok: true, json: async () => ({ text: 'Still here.' }) }), 25000);
    });
    const item = { id: 'slow', chatId: 'chat', message: { id: 'slow', text: 'Hello', sender: 'me' }, notificationData: { chatName: 'Maya', provider: 'vertex' } };
    fixture.stores.get('pending_outbox')!.set(item.id, item);
    const delivery = fixture.context.deliver(item);
    await new Promise(resolve => setImmediate(resolve));
    mock.timers.tick(25000);
    await delivery;
    assert.equal(requests, 1);
    assert.equal(fixture.notifications.at(-1).body, 'Still here.');
    assert.equal(fixture.stores.get('pending_outbox')!.size, 0);
  } finally { mock.timers.reset(); }
});

test('offline notification input is durable and shows every fragment of the current persona answer', async () => {
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
  assert.equal(fixture.notifications.at(-1).body, 'An older fragment.\nHere is the newest reply.');
  assert.ok(!fixture.notifications.at(-1).body.includes('─'));
  assert.equal(fixture.notifications.at(-1).icon, '/persona-test.png');
  const count = fixture.notifications.length;
  await fixture.context.deliver(items[0]);
  assert.equal(fixture.notifications.length, count, 'Completed outbox item must not deliver twice');
  const next = { id: 'next-turn', chatId: 'chat', message: { id: 'next-message', text: 'Next question', sender: 'me' }, notificationData: { chatName: 'Maya', chatAvatar: '/persona-test.png', provider: 'vertex', recentMessages: [...saved.personaReplies, { text: 'Old response must not return', sender: 'other' }] } };
  fixture.stores.get('pending_outbox')!.set(next.id, next);
  await fixture.context.deliver(next);
  assert.equal(fixture.notifications.at(-1).tag, 'chat', 'Next response replaces the same chat notification');
  assert.equal(fixture.notifications.at(-1).body, 'An older fragment.\nHere is the newest reply.', 'Only the current turn appears, not the conversation history');
  assert.ok(fixture.notifications.at(-1).actions.some((action: any) => action.action === 'reply'));
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
});

test('page and worker notifications keep line breaks without empty lines', () => {
  const worker = workerFixture().context.notificationConversation;
  for (const [input, expected] of [
    ['First\n\nSecond\n\n\nThird', 'First\nSecond\nThird'],
    ['First\n \t\nSecond', 'First\nSecond'],
    ['First\r\n\r\nSecond', 'First\nSecond'],
    ['First\nSecond', 'First\nSecond'],
    ['Same words, same spacing.', 'Same words, same spacing.'],
  ]) {
    assert.equal(notificationConversation('User text', input), expected);
    assert.equal(worker('User text', input), expected);
  }
});

test('expired background reply stays failed for manual retry without inventing a persona response', async () => {
  const fixture = workerFixture();
  const item = { id: 'expired', chatId: 'chat', queuedAt: 0, retryStartedAt: Date.now() - 60000, attempts: 2, message: { id: 'expired', text: 'Are you there?', sender: 'me' }, notificationData: { chatName: 'Maya', provider: 'vertex' } };
  fixture.stores.get('pending_outbox')!.set(item.id, item);
  await fixture.context.deliver(item);
  assert.equal(fixture.requests, 0);
  assert.equal(fixture.stores.get('pending_outbox')!.size, 1);
  assert.equal(fixture.stores.get('pending_outbox')!.get(item.id).message.status, 'failed');
  const saved = [...fixture.stores.get('synced_background')!.values()][0];
  assert.equal(saved.personaReplies.length, 0);
  assert.equal(saved.userMessage.status, 'failed');
  assert.equal(fixture.notifications.at(-1).body, 'Message not sent. Open chat to retry.');
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
