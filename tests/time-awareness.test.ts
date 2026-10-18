import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getTimeGapAndFrequencyContext } from '../utils/dates';
import { buildFullPersonaSystemPrompt } from '../services/geminiService';
import { parsePersonaBackup } from '../utils/personaBackup';

test('time awareness defaults on and suppresses gap/frequency context when disabled', () => {
  const now = Date.now();
  const messages = [{ id: 'old', sender: 'other', text: 'Hello', timestampEpoch: now - 4 * 86400000 }, { id: 'new', sender: 'me', text: 'Hi', timestampEpoch: now }] as any;
  assert.ok(getTimeGapAndFrequencyContext(messages, false)?.includes('TIME GAP DETECTED'));
  assert.equal(getTimeGapAndFrequencyContext(messages, false, undefined, false), undefined);
  messages[0].call = { endedAt: now - 600000 };
  assert.equal(getTimeGapAndFrequencyContext(messages, false), undefined, 'Recent call end should count as recent contact');
});

test('persona toggle suppresses absence reactions while preserving the global clock setting', () => {
  const enabled = buildFullPersonaSystemPrompt({ name: 'Maya' }, [], undefined, undefined, { shareTimeContext: true } as any);
  const disabled = buildFullPersonaSystemPrompt({ name: 'Maya', timeAwarenessEnabled: false }, [], undefined, undefined, { shareTimeContext: true } as any);
  assert.ok(enabled.includes('CURRENT SYSTEM DATE AND TIME'));
  assert.ok(disabled.includes('CURRENT SYSTEM DATE AND TIME') && disabled.includes('TIME AWARENESS OFF') && !disabled.includes('ENCOURAGED to naturally acknowledge relative time gaps'));
});

test('persona backup preserves explicit off, accepts legacy defaults and rejects invalid flags', () => {
  assert.equal(parsePersonaBackup({ name: 'Maya', timeAwarenessEnabled: false }).timeAwarenessEnabled, false);
  assert.equal(parsePersonaBackup({ name: 'Maya' }).timeAwarenessEnabled, undefined);
  assert.throws(() => parsePersonaBackup({ name: 'Maya', timeAwarenessEnabled: 'false' }));
});
