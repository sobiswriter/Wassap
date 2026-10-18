import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

test('notification End persists intent before dispatch and does not clear another call', async () => {
  const handlers: Record<string, Function> = {};
  const records = new Map<string, Response>();
  const events: any[] = [];
  const cache = { match: async (key: string) => records.get(key)?.clone(), put: async (key: string, response: Response) => { records.set(key, response.clone()); }, delete: async (key: string) => records.delete(key) };
  const context = {
    self: { addEventListener: (type: string, handler: Function) => { handlers[type] = handler; }, registration: { showNotification: async (_title: string, options: any) => events.push({ notification: options }) } },
    caches: { open: async () => cache }, clients: { matchAll: async () => [{ postMessage: (data: any) => events.push(data) }] },
    Response, console, URL, Date, Math, Promise, setTimeout, clearTimeout,
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8'), context);
  let pending: Promise<any> = Promise.resolve();
  const waitUntil = (promise: Promise<any>) => { pending = promise; };
  handlers.message({ data: { type: 'CALL_STATE', callId: 'new-call', chatId: 'persona', expiresAt: Date.now() + 40000 }, waitUntil }); await pending;
  handlers.notificationclick({ action: 'end-call', notification: { title: 'Maya', data: { kind: 'persona-call', callId: 'old-call', chatId: 'persona' } }, waitUntil }); await pending;
  assert.equal(await (await cache.match('/__call_end/old-call'))?.text(), 'end');
  assert.equal(events[0].notification.body, 'Ending call…');
  assert.equal(events[1].type, 'CALL_END');
  assert.equal(events[1].callId, 'old-call');
  handlers.message({ data: { type: 'CALL_STATE', callId: 'old-call', chatId: 'persona', ended: true }, waitUntil }); await pending;
  assert.equal((await (await cache.match('/__call_active'))?.json()).callId, 'new-call');
  assert.equal(await cache.match('/__call_end/old-call'), undefined);
});
