import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { once } from 'node:events';
import { Live, Models } from '@google/genai';
import { WebSocket } from 'ws';
import server, { liveRequestAllowed } from '../api/gemini/live';

test('call upgrade requires both member authentication and matching origin', () => {
  const old = process.env.VERTEX_PASSCODE;
  process.env.VERTEX_PASSCODE = 'synthetic-passkey';
  try {
    const headers = { host: 'wassap.test', origin: 'https://wassap.test', cookie: 'wassap_vertex=synthetic-passkey' };
    assert.equal(liveRequestAllowed({ headers } as any), true);
    for (const changed of [{ origin: 'https://evil.test' }, { origin: '' }, { cookie: '' }, { cookie: 'wassap_vertex=%ZZ' }]) assert.equal(liveRequestAllowed({ headers: { ...headers, ...changed } } as any), false);
  } finally { if (old === undefined) delete process.env.VERTEX_PASSCODE; else process.env.VERTEX_PASSCODE = old; }
});

test('authenticated Live relay streams PCM and closes upstream when user hangs up', async () => {
  const old = process.env.VERTEX_PASSCODE;
  process.env.VERTEX_PASSCODE = 'synthetic-passkey';
  const received: any[] = []; let closed = false; let config: any;
  const upstream = mock.method(Live.prototype, 'connect', async function (options: any) {
    config = options;
    setTimeout(() => options.callbacks.onmessage({ setupComplete: {} }), 5);
    return { sendRealtimeInput: (frame: any) => received.push(frame), sendClientContent: () => {}, close: () => { closed = true; } } as any;
  });
  let socket: WebSocket | undefined;
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const host = `127.0.0.1:${(server.address() as any).port}`;
    socket = new WebSocket(`ws://${host}/api/gemini/live`, { headers: { Origin: `http://${host}`, Cookie: 'wassap_vertex=synthetic-passkey' } });
    await once(socket, 'open');
    socket.send(JSON.stringify({ type: 'start', prompt: 'You are Maya.', voice: 'Fenrir' }));
    const [message] = await once(socket, 'message');
    assert.ok(JSON.parse(message.toString()).setupComplete);
    assert.equal(config.model, 'gemini-3.8-live');
    assert.equal(config.config.systemInstruction, 'You are Maya.');
    assert.deepEqual(config.config.realtimeInputConfig, { automaticActivityDetection: { disabled: false,
      startOfSpeechSensitivity: 'START_SENSITIVITY_LOW', endOfSpeechSensitivity: 'END_SENSITIVITY_LOW', prefixPaddingMs: 200, silenceDurationMs: 900 }, activityHandling: 'START_OF_ACTIVITY_INTERRUPTS' });
    assert.equal(config.config.speechConfig.voiceConfig.prebuiltVoiceConfig.voiceName, 'Fenrir');
    socket.send(Buffer.from([0, 0, 255, 127]));
    socket.send(JSON.stringify({ type: 'audioEnd' }));
    socket.send(JSON.stringify({ type: 'end' }));
    await once(socket, 'close');
    assert.equal(received[0].audio.mimeType, 'audio/pcm;rate=16000');
    assert.deepEqual(Buffer.from(received[0].audio.data, 'base64'), Buffer.from([0, 0, 255, 127]));
    assert.deepEqual(received[1], { audioStreamEnd: true });
    assert.equal(closed, true);
    socket = new WebSocket(`ws://${host}/api/gemini/live`, { headers: { Origin: `http://${host}`, Cookie: 'wassap_vertex=synthetic-passkey' } });
    await once(socket, 'open');
    const voiceSample = Buffer.alloc(10 * 24000 * 2).toString('base64');
    socket.send(JSON.stringify({ type: 'start', prompt: 'You are Maya.', voice: 'Fenrir', voiceSample }));
    const [customMessage] = await once(socket, 'message');
    assert.ok(JSON.parse(customMessage.toString()).setupComplete);
    assert.deepEqual(config.config.speechConfig.voiceConfig, { replicatedVoiceConfig: { voiceSampleAudio: voiceSample, mimeType: 'audio/pcm;rate=24000' } });
    socket.send(JSON.stringify({ type: 'end' }));
    await once(socket, 'close');
    const calls = upstream.mock.callCount();
    socket = new WebSocket(`ws://${host}/api/gemini/live`, { headers: { Origin: `http://${host}`, Cookie: 'wassap_vertex=synthetic-passkey' } });
    await once(socket, 'open');
    socket.send(JSON.stringify({ type: 'start', prompt: 'You are Maya.', voice: 'Fenrir', voiceSample: 'bad' }));
    const [invalid] = await once(socket, 'message');
    assert.ok(JSON.parse(invalid.toString()).error);
    await once(socket, 'close');
    assert.equal(upstream.mock.callCount(), calls, 'Invalid sample reached the provider');
  } finally {
    socket?.terminate(); upstream.mock.restore();
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (old === undefined) delete process.env.VERTEX_PASSCODE; else process.env.VERTEX_PASSCODE = old;
  }
});

test('call context endpoint validates last-20 limit and summarizes text only', async () => {
  const old = process.env.VERTEX_PASSCODE;
  process.env.VERTEX_PASSCODE = 'synthetic-passkey';
  let request: any;
  const upstream = mock.method(Models.prototype as any, 'generateContentInternal', async (config: any) => { request = config; return { text: 'We promised to meet by the river.' } as any; });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as any).port}/api/gemini/live`;
    const post = (body: any, cookie = 'wassap_vertex=synthetic-passkey') => fetch(url, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    assert.equal((await post({ messages: [] }, '')).status, 401);
    assert.equal((await post({ messages: Array.from({ length: 21 }, () => ({ speaker: 'User', text: 'hi' })) })).status, 400);
    assert.equal((await post({ messages: [{ speaker: 'User', text: 'a'.repeat(2001) }] })).status, 400);
    assert.equal(upstream.mock.callCount(), 0);
    const result = await post({ messages: [{ speaker: 'User', text: 'Meet by the river.', hidden: 'DO_NOT_SEND' }], persona: 'DO_NOT_SEND' });
    assert.equal(result.status, 200); assert.deepEqual(await result.json(), { summary: 'We promised to meet by the river.' });
    assert.equal(request.model, 'gemini-3.8-flash');
    assert.deepEqual(JSON.parse(request.contents), [{ speaker: 'User', text: 'Meet by the river.' }]);
    assert.ok(request.config.systemInstruction.includes('quoted data'));
  } finally {
    upstream.mock.restore(); await new Promise<void>(resolve => server.close(() => resolve()));
    if (old === undefined) delete process.env.VERTEX_PASSCODE; else process.env.VERTEX_PASSCODE = old;
  }
});
