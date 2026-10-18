import assert from 'node:assert/strict';
import { test } from 'node:test';
import { callDuration, shouldSummarizeCall, buildCallDiaryMessages, pcm16, formatCallDuration, recentCallMessages, callTranscript, callHistoryText } from '../utils/calls';
import { callPrompt } from '../services/liveCall';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('call context includes only last 20 nondeleted text messages, with bounded content', () => {
  const messages = Array.from({ length: 25 }, (_, i) => ({ sender: i % 2 ? 'other' : 'me', text: `message-${i}`, isDeleted: i === 24 }));
  const selected = recentCallMessages(messages);
  assert.equal(selected.length, 20); assert.equal(selected[0].text, 'message-4'); assert.equal(selected.at(-1)?.text, 'message-23');
  assert.equal(recentCallMessages([{ sender: 'me', text: 'a'.repeat(3000) }])[0].text.length, 2000);
  const prompt = callPrompt({ name: 'Maya', about: 'Old friend', messages, role: 'SECRET_ROLE', systemInstruction: 'SECRET_PROMPT',
    memoryBubbles: [{ summary: 'SECRET_DIARY' }], speechStyle: 'SECRET_SPEECH', schedule: 'SECRET_SCHEDULE' } as any, 'We discussed Kyoto.');
  assert.ok(prompt.includes('Maya') && prompt.includes('Old friend') && prompt.includes('We discussed Kyoto.'));
  for (const extra of ['SECRET_', 'message-']) assert.ok(!prompt.includes(extra), `Extra context leaked: ${extra}`);
  assert.equal(callTranscript([{ speaker: 'me', text: 'Hello' }, { speaker: 'other', text: 'Hi', interrupted: true }], 'Maya'), 'You: Hello\nMaya: Hi [interrupted; may not have been fully heard]');
});

test('capture worklet emits 40 ms PCM batches at 16 kHz across input rates', () => {
  for (const rate of [48000, 44100]) {
    const frames: Float32Array[] = []; let Capture: any;
    vm.runInNewContext(readFileSync(new URL('../public/call-capture.js', import.meta.url), 'utf8'), {
      sampleRate: rate, Float32Array, AudioWorkletProcessor: class { port = { postMessage: (frame: Float32Array) => frames.push(frame) }; },
      registerProcessor: (_name: string, value: any) => { Capture = value; },
    });
    const worklet = new Capture();
    for (let offset = 0; offset < rate; offset += 128) worklet.process([[new Float32Array(Math.min(128, rate - offset)).fill(0.25)]]);
    assert.equal(frames.length, 25); assert.ok(frames.every(frame => frame.length === 640 && frame.every(value => value === 0.25)));
  }
});

test('call chat context carries explicit timestamps and conversation independently of diary', () => {
  const record = { id: 'test', chatId: 'maya', startedAt: Date.parse('2026-10-18T10:00:00Z'), endedAt: Date.parse('2026-10-18T10:02:00Z'), duration: 100, outcome: 'ended', diary: 'pending', turns: [{ speaker: 'me', text: 'Meet by the river.' }, { speaker: 'other', text: 'At five.' }] } as any;
  const raw = callHistoryText(record, 'Maya');
  assert.ok(raw.includes('2026-10-18T10:00:00.000Z') && raw.includes('2026-10-18T10:02:00.000Z') && raw.includes('Maya: At five.'));
  const summary = callHistoryText(record, 'Maya', 'We agreed to meet by the river at five.');
  assert.ok(summary.includes('Call summary: We agreed') && !summary.includes('Call transcript'));
});

test('call diary requires a minute connected and a usable transcript', () => {
  const turns = [{ speaker: 'me' as const, text: 'Remember our trip to Kyoto.' }, { speaker: 'other' as const, text: 'The rain at the temple was lovely.' }];
  assert.equal(shouldSummarizeCall({ duration: 59, turns }), false);
  assert.equal(shouldSummarizeCall({ duration: 60, turns }), true);
  assert.equal(shouldSummarizeCall({ duration: 120, turns: turns.slice(0, 1) }), true);
  assert.equal(shouldSummarizeCall({ duration: 120, turns: [] }), false);
  assert.equal(callDuration(4000, 65000), 61);
  assert.equal(formatCallDuration(65), '1:05');
});

test('call diary retains the beginning, middle, end and interrupted attribution', () => {
  const turns = Array.from({ length: 120 }, (_, i) => ({ speaker: i % 2 ? 'other' as const : 'me' as const, text: `fact-${i}`, interrupted: i === 59 }));
  const result = buildCallDiaryMessages({ turns, startedAt: Date.parse('2026-10-18T10:00:00Z'), duration: 600 } as any, 'Maya', 'Sam');
  assert.equal(result.length, 1);
  for (const fact of ['Sam: fact-0', 'Maya: fact-59 [interrupted', 'Maya: fact-119']) assert.ok(result[0].text.includes(fact), fact);
});

test('PCM conversion clips safely and preserves signed little-endian samples', () => {
  const data = pcm16(new Float32Array([-2, -1, 0, 1, 2]));
  const view = new DataView(data.buffer);
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => view.getInt16(i * 2, true)), [-32768, -32768, 0, 32767, 32767]);
});
