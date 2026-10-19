import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PersonaCall } from '../services/liveCall';

const fixture = () => new PersonaCall({ id: 'test', name: 'Maya', voiceSettings: { voiceName: 'Aoede' } } as any, {} as any, {} as any, () => {}) as any;

test('normal audio bursts over eight seconds stay in the same call', () => {
  const call = fixture(); let ended = false;
  call.end = () => { ended = true; };
  call.gain = {};
  call.audio = { state: 'running', currentTime: 0,
    createBuffer: (_channels: number, size: number, rate: number) => ({ duration: size / rate, getChannelData: () => new Float32Array(size) }),
    createBufferSource: () => ({ connect() {}, start() {}, disconnect() {}, stop() {} }) };
  const chunk = Buffer.alloc(4 * 24000 * 2).toString('base64');
  for (let i = 0; i < 3; i++) call.play(chunk);
  assert.equal(ended, false); assert.equal(call.sources.size, 3);
});

test('suspended audio marks an unheard turn without hanging up', () => {
  const call = fixture(); let resumed = false; let ended = false;
  call.end = () => { ended = true; }; call.gain = {};
  call.audio = { state: 'suspended', resume: async () => { resumed = true; } };
  call.play('AAAA');
  assert.equal(ended, false); assert.equal(resumed, true); assert.equal(call.playbackInterrupted, true);
});

test('duplicate close/error callbacks schedule one session recovery', () => {
  const call = fixture(); call.generation = 4; call.handle = 'resume';
  call.stopAudio = () => {}; call.commitTurns = () => {};
  call.disconnected(4); const timer = call.reconnectTimer;
  try { call.disconnected(4); assert.equal(call.reconnectTimer, timer); assert.equal(call.reconnects, 1); }
  finally { clearTimeout(timer); }
});
