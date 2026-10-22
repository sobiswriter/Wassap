import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pendingDeliveryTurn, deliveryHistory, beginPendingAttempt, setPendingDeliveryStatus } from '../utils/offlineQueue';

const item = (id: string, status = 'pending', deliveryGroupId?: string) => ({ id, chatId: 'chat', queuedAt: 0, message: { id, sender: 'me', text: id, status, deliveryGroupId } }) as any;

test('unstacked delivery selects one prompt and skips manually failed sends', () => {
  const items = [item('failed', 'failed'), item('first'), item('second')];
  assert.deepEqual(pendingDeliveryTurn(items, false).map(item => item.id), ['first']);
});

test('retry keeps its original stack separate from newer prompts and other failed stacks', () => {
  const items = [item('old', 'failed', 'old'), item('a', 'pending', 'b'), item('b', 'pending', 'b'), item('new')];
  assert.deepEqual(pendingDeliveryTurn(items, true).map(item => item.id), ['a', 'b']);
  assert.deepEqual(pendingDeliveryTurn([item('a'), item('b')], true).map(item => item.id), ['a', 'b']);
  assert.deepEqual(pendingDeliveryTurn([item('a', 'failed')], true), []);
});

test('retry history ends at the selected prompt and preserves attachments without including failed or newer prompts', () => {
  const attachment = { type: 'image', mediaId: 'saved-image' };
  const history: any[] = [{ id: 'previous', sender: 'other', text: 'Earlier answer' }, { id: 'failed', sender: 'me', status: 'failed' }, { id: 'retry', sender: 'me', attachment }, { id: 'new', sender: 'me' }];
  const selected = deliveryHistory(history, ['retry']);
  assert.deepEqual(selected.map(message => message.id), ['previous', 'retry']);
  assert.equal(selected[1].attachment, attachment);
});

test('failed outbox records survive and manual retry resets only the captured batch, preserving media and notification context', async () => {
  const previous = globalThis.indexedDB;
  const records = new Map<string, any>([
    ['a', { ...item('a'), notificationData: { provider: 'vertex' } }],
    ['b', { ...item('b'), message: { ...item('b').message, mediaId: 'existing-photo' } }],
    ['later', item('later', 'failed', 'later')],
  ]);
  globalThis.indexedDB = { open() {
    const request: any = { result: { close() {}, transaction() {
      const tx: any = { objectStore: () => ({
        getAll() { const read: any = { result: [...records.values()].map(value => structuredClone(value)) }; queueMicrotask(() => { read.onsuccess(); setImmediate(() => tx.oncomplete?.()); }); return read; },
        put(value: any) { records.set(value.id, structuredClone(value)); setImmediate(() => tx.oncomplete?.()); }
      }) };
      return tx;
    } } };
    queueMicrotask(() => request.onsuccess()); return request;
  } } as any;
  try {
    const history = [...records.values()].map(item => item.message);
    const attempt = await beginPendingAttempt('chat', history, true);
    assert.deepEqual(attempt?.messageIds, ['a', 'b']);
    assert.equal(records.get('a').message.deliveryGroupId, 'b');
    assert.equal(records.get('b').attempts, 1);
    await setPendingDeliveryStatus('chat', attempt!.messageIds, 'failed');
    assert.equal(records.size, 3, 'Failure must retain all queued records');
    assert.equal(pendingDeliveryTurn([...records.values()], true).length, 0);
    const later = structuredClone(records.get('later'));
    await setPendingDeliveryStatus('chat', attempt!.messageIds, 'pending');
    assert.equal(records.get('a').attempts, 0);
    assert.equal(records.get('a').retryStartedAt, undefined);
    assert.equal(records.get('a').nextAttemptAt, 0);
    assert.equal(records.get('a').message.deliveryGroupId, 'b');
    assert.equal(records.get('b').message.mediaId, 'existing-photo');
    assert.deepEqual(records.get('a').notificationData, { provider: 'vertex' });
    assert.deepEqual(records.get('later'), later);
    assert.deepEqual(pendingDeliveryTurn([...records.values()], false).map(item => item.id), ['a', 'b'], 'A captured stack must survive changing the stacking setting');
  } finally { globalThis.indexedDB = previous; }
});
