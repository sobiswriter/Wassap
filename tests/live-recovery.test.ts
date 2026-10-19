import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { Live } from '@google/genai';
import { PersonaCall } from '../services/liveCall';
import { normalizeLiveModel } from '../constants';

const fixture = () => new PersonaCall({ id: 'test', name: 'Maya', voiceSettings: { voiceName: 'Aoede' } } as any, {} as any, {} as any, () => {}) as any;

test('Live model and voice remain fixed across resumption; Thinking keeps receiving after intermediate turns', async () => {
  const requests: any[] = []; const greetings: any[] = []; const played: string[] = [];
  const upstream = mock.method(Live.prototype, 'connect', async (options: any) => {
    requests.push(options); return { sendClientContent: (data: any) => greetings.push(data), close() {} } as any;
  });
  const chat = { id: 'test', name: 'Maya', voiceSettings: { voiceName: 'Fenrir', stylePrompt: 'warm', pitchTone: 'very high' } } as any;
  const settings = { aiProvider: 'studio', apiKey: 'synthetic', selectedLiveModel: 'gemini-3.8-live-extended-thinking' } as any;
  const call = new PersonaCall(chat, settings, {} as any, () => {}) as any;
  call.persist = () => {}; call.notify = async () => {}; call.play = (bytes: string) => played.push(bytes);
  try {
    await call.connect();
    const first = requests[0]; first.callbacks.onmessage({ setupComplete: {} });
    assert.equal(first.model, 'gemini-3.8-live-extended-thinking');
    assert.deepEqual(first.config.thinkingConfig, { thinkingLevel: 'LOW' });
    assert.equal(first.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Fenrir');
    assert.ok(!first.config.systemInstruction.includes('very high'));
    first.callbacks.onmessage({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'filler-audio' } }] }, outputTranscription: { text: 'Let me think.' }, turnComplete: true, interactionStatus: 'IN_PROGRESS' } });
    assert.equal(call.snapshot.processing, true);
    first.callbacks.onmessage({ serverContent: { modelTurn: { parts: [{ inlineData: { data: 'final-audio' } }] }, outputTranscription: { text: 'Here is my answer.' }, turnComplete: true, interactionStatus: 'IDLE' } });
    assert.equal(call.snapshot.processing, false); assert.deepEqual(played, ['filler-audio', 'final-audio']);
    assert.equal(call.snapshot.turns.length, 2);
    first.callbacks.onmessage({ interactionStatus: 'IN_PROGRESS' }); assert.equal(call.snapshot.processing, true);
    first.callbacks.onmessage({ interaction_status: 'IDLE' }); assert.equal(call.snapshot.processing, false);
    chat.voiceSettings.voiceName = 'Aoede'; chat.voiceSettings.stylePrompt = 'different'; settings.selectedLiveModel = 'gemini-3.8-live';
    call.handle = 'resume-same-session'; await call.connect();
    const resumed = requests[1]; resumed.callbacks.onmessage({ setupComplete: {} });
    assert.equal(resumed.model, first.model);
    assert.deepEqual(resumed.config.speechConfig, first.config.speechConfig);
    assert.equal(resumed.config.systemInstruction, first.config.systemInstruction);
    assert.equal(resumed.config.sessionResumption.handle, 'resume-same-session');
    assert.equal(greetings.length, 1, 'Resuming must not start another greeting');
    first.callbacks.onmessage({ serverContent: { outputTranscription: { text: 'Old connection audio' }, turnComplete: true } });
    assert.equal(call.snapshot.turns.length, 2, 'An old connection must never contribute a second voice stream');
    const normal = fixture(); normal.settings.aiProvider = 'studio'; normal.settings.apiKey = 'synthetic';
    try { await normal.connect(); assert.equal(requests.at(-1).config.thinkingConfig, undefined); }
    finally { clearTimeout(normal.setupTimer); }
    assert.equal(normalizeLiveModel('unknown'), 'gemini-3.8-live');
  } finally { clearTimeout(call.setupTimer); upstream.mock.restore(); }
});

test('ringback waits 1.5 seconds after each clip and cancels a pending repeat on pickup', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const originalAudio = globalThis.Audio; let plays = 0; let paused = false;
  globalThis.Audio = class { loop = true; currentTime = 0; onended?: () => void; play() { plays++; return Promise.resolve(); } pause() { paused = true; } } as any;
  const call = fixture(); call.notify = async () => {};
  try {
    const ringing = call.ring(); const player = call.ringPlayer;
    assert.equal(plays, 1); assert.equal(player.loop, false);
    player.onended(); t.mock.timers.tick(1499); assert.equal(plays, 1);
    t.mock.timers.tick(1); assert.equal(plays, 2);
    player.onended(); call.stopRing(); t.mock.timers.tick(1500);
    assert.equal(plays, 2); assert.equal(paused, true); assert.equal(player.onended, null);
    call.preparation.abort(); await ringing;
  } finally { call.stopRing(); call.preparation.abort(); globalThis.Audio = originalAudio; }
});

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
