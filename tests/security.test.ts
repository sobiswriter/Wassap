import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { isPasscodeValid } from '../server/api';
import { resolveMediaToInlineData } from '../server/vertexHandler';
import { AVAILABLE_MODELS } from '../constants';

test('server passcode override is respected', () => {
  const previous = process.env.VERTEX_PASSCODE;
  try {
    process.env.VERTEX_PASSCODE = 'test-member-passkey';
    assert.equal(isPasscodeValid({ headers: { 'x-vertex-passcode': 'test-member-passkey' } } as any), true);
    assert.equal(isPasscodeValid({ headers: { 'x-vertex-passcode': 'wrong' } } as any), false);
  } finally {
    if (previous === undefined) delete process.env.VERTEX_PASSCODE;
    else process.env.VERTEX_PASSCODE = previous;
  }
});

test('media resolver refuses loopback without contacting it', async () => {
  let hits = 0;
  const server = createServer((_req, res) => { hits++; res.writeHead(200, { 'content-type': 'image/png' }); res.end('private'); });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = (server.address() as any).port;
    assert.equal(await resolveMediaToInlineData(`http://127.0.0.1:${port}/private`), null);
    assert.equal(hits, 0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

test('only the two requested text models are offered', () => {
  assert.deepEqual(AVAILABLE_MODELS.map(model => model.id).sort(), ['gemini-3.5-flash-lite', 'gemini-3.8-flash']);
});
import { readFileSync, readdirSync } from 'node:fs';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import dns from 'node:dns/promises';
import http from 'node:http';
import { mock } from 'node:test';
import authHandler from '../api/gemini/auth';
import { fetchRemoteMedia, isPublicMediaAddress } from '../server/remoteMedia';
import { parsePersonaBackup } from '../utils/personaBackup';
import { normalizeTextModel } from '../constants';

function responseRecorder() {
  return { statusCode: 200, headers: {} as Record<string, any>, body: '',
    setHeader(name: string, value: any) { this.headers[name.toLowerCase()] = value; },
    end(value = '') { this.body = value; } };
}

test('unlock cookie is HTTP-only, HTTPS-only on HTTPS, and works for future requests', async () => {
  const previous = process.env.VERTEX_PASSCODE;
  process.env.VERTEX_PASSCODE = 'test-member-passkey';
  try {
    const res = responseRecorder();
    await authHandler({ method: 'POST', headers: { host: 'wassap.test', origin: 'https://wassap.test', 'x-forwarded-proto': 'https' }, body: { passcode: 'test-member-passkey' } } as any, res as any);
    assert.equal(res.statusCode, 200);
    const cookie = res.headers['set-cookie'];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.match(cookie, /; Secure/);
    assert.equal(isPasscodeValid({ headers: { cookie: cookie.split(';')[0] } } as any), true);
    const invalid = responseRecorder();
    await authHandler({ method: 'POST', headers: {}, body: { passcode: 'wrong' } } as any, invalid as any);
    assert.equal(invalid.statusCode, 401);
    const crossOrigin = responseRecorder();
    await authHandler({ method: 'POST', headers: { host: 'wassap.test', origin: 'https://attacker.test' }, body: { passcode: 'test-member-passkey' } } as any, crossOrigin as any);
    assert.equal(crossOrigin.statusCode, 403);
    const locked = responseRecorder();
    await authHandler({ method: 'DELETE', headers: {} } as any, locked as any);
    assert.match(locked.headers['set-cookie'], /Max-Age=0/);
    assert.equal(isPasscodeValid({ headers: { cookie: 'wassap_vertex=%ZZ' } } as any), false);
  } finally {
    if (previous === undefined) delete process.env.VERTEX_PASSCODE;
    else process.env.VERTEX_PASSCODE = previous;
  }
});

test('every standalone paid endpoint rejects missing authentication and mirrors the cookie check', async () => {
  const canonical = readFileSync('api/gemini/auth.ts', 'utf8').match(/function isPasscodeValid\(.*?\n}/s)![0];
  for (const file of readdirSync('api/gemini').filter(file => file.endsWith('.ts') && !['auth.ts', 'status.ts'].includes(file))) {
    const source = readFileSync(`api/gemini/${file}`, 'utf8');
    assert.ok(source.includes(canonical), `${file} authentication differs`);
    const { default: handler } = await import(`../api/gemini/${file}`);
    const res = responseRecorder();
    await handler({ method: 'POST', url: `/api/gemini/${file.slice(0, -3)}`, headers: {}, body: {} }, res);
    assert.equal(res.statusCode, 401, file);
  }
});

test('standalone remote-media guards match the canonical implementation', () => {
  const source = readFileSync('server/remoteMedia.ts', 'utf8').replace(/\r\n/g, '\n').split('\n\n').slice(1).join('\n\n').replace('export function', 'function').replace('export async function', 'async function').trim();
  for (const file of ['generate', 'image', 'image-generate']) {
    assert.ok(readFileSync(`api/gemini/${file}.ts`, 'utf8').replace(/\r\n/g, '\n').includes(source), `${file} media guard differs`);
  }
});

test('backup validation preserves a valid legacy profile and rejects unsafe field shapes', () => {
  const persona = { name: 'Existing persona', avatar: 'data:image/png;base64,AAAA', about: 'keep me', memoryEnabled: true,
    memoryBubbles: [{ id: 'memory-1', chatId: 'old-id', title: 'Keep this memory', startDate: '2026-10-01', endDate: '2026-10-02', summary: 'Private memory', createdAt: '2026-10-02' }],
    voiceSettings: { voiceName: 'Aoede', frequency: 'always', voiceForVoice: true },
    schedule: { enabled: true, weekday: [{ id: 'day', context: 'Study', startTime: '08:00', endTime: '17:00' }], weekend: [], weekendDays: [0, 6] },
    automation: { enabled: true, timeTriggers: [], inactivity: { enabled: true, hours: 1, minutes: 0, seconds: 0 } } };
  const snapshot = JSON.stringify(persona);
  assert.deepEqual(parsePersonaBackup(persona), persona);
  assert.deepEqual(parsePersonaBackup({ type: 'wassap-persona-backup', version: 1, persona }), persona);
  assert.equal(JSON.stringify(persona), snapshot);
  for (const invalid of [null, [], { name: 123 }, { name: ' ' }, { name: 'X', schedule: { enabled: true, weekday: 'invalid', weekend: [] } }, { name: 'X', memoryBubbles: [null] }, { name: 'X', voiceSettings: { voiceName: {} } }]) {
    assert.throws(() => parsePersonaBackup(invalid), /Invalid persona backup/);
  }
});

test('old saved text models fall back without changing supported choices', () => {
  assert.equal(normalizeTextModel('gemini-3.7-flash'), 'gemini-3.8-flash');
  for (const model of AVAILABLE_MODELS) assert.equal(normalizeTextModel(model.id), model.id);
});

test('media address checks block IPv4, IPv6, mapped, metadata, and reserved ranges', () => {
  for (const address of ['127.0.0.1', '10.1.2.3', '169.254.169.254', '172.31.1.2', '192.168.0.1', '100.64.0.1', '0.0.0.0', '192.0.2.1', '224.0.0.1', '::1', '::', 'fc00::1', 'fe80::1', '::ffff:127.0.0.1', '2002:7f00:1::', '2001:db8::1']) assert.equal(isPublicMediaAddress(address), false, address);
  for (const address of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111']) assert.equal(isPublicMediaAddress(address), true, address);
});

function mockMediaResponse(options: { chunks?: string[]; location?: string; status?: number; contentLength?: number; stall?: boolean }) {
  let requests = 0;
  const lookup = mock.method(dns, 'lookup', async () => [{ address: '8.8.8.8', family: 4 }]);
  const request = mock.method(http, 'request', (_url: any, init: any, callback: any) => {
    requests++;
    let pinned: any;
    init.lookup('public.test', { all: true }, (_error: any, addresses: any) => pinned = addresses);
    assert.deepEqual(pinned, [{ address: '8.8.8.8', family: 4 }]);
    const req = new EventEmitter() as any;
    req.end = () => queueMicrotask(() => {
      const res = new PassThrough() as any;
      res.statusCode = options.status || 200;
      res.headers = { 'content-type': 'image/png', ...(options.location ? { location: options.location } : {}), ...(options.contentLength ? { 'content-length': String(options.contentLength) } : {}) };
      const abort = () => { res.destroy(); req.emit('error', new Error('aborted')); };
      init.signal.addEventListener('abort', abort, { once: true });
      res.on('close', () => init.signal.removeEventListener('abort', abort));
      callback(res);
      if (!options.stall) { for (const chunk of options.chunks || []) res.write(chunk); res.end(); }
    });
    return req;
  });
  return { lookup, request, get requests() { return requests; }, restore() { lookup.mock.restore(); request.mock.restore(); } };
}

test('public media succeeds with DNS pinned and bytes preserved', async () => {
  const network = mockMediaResponse({ chunks: ['image', '-bytes'] });
  try { const result = await fetchRemoteMedia('http://public.test/image'); assert.equal(result.data.toString(), 'image-bytes'); assert.equal(result.mimeType, 'image/png'); }
  finally { network.restore(); }
});

test('media redirects are rechecked before reaching a private destination', async () => {
  const network = mockMediaResponse({ status: 302, location: 'http://127.0.0.1/private' });
  try { await assert.rejects(fetchRemoteMedia('http://public.test/image'), /blocked/); assert.equal(network.requests, 1); }
  finally { network.restore(); }
});

test('media downloads enforce header and streamed size limits', async () => {
  for (const options of [{ contentLength: 100, chunks: [] }, { chunks: ['123', '456'] }]) {
    const network = mockMediaResponse(options);
    try { await assert.rejects(fetchRemoteMedia('http://public.test/image', 4), /size limit/); }
    finally { network.restore(); }
  }
});

test('media timeout covers stalled response bodies and DNS', async () => {
  const network = mockMediaResponse({ stall: true });
  try { await assert.rejects(fetchRemoteMedia('http://public.test/image', 100, 30), /timed out|aborted/); }
  finally { network.restore(); }
  const lookup = mock.method(dns, 'lookup', () => new Promise(() => {}));
  try { await assert.rejects(fetchRemoteMedia('http://public.test/image', 100, 30), /timed out/); }
  finally { lookup.mock.restore(); }
});
import { runInNewContext } from 'node:vm';

test('background replies use the saved Gemini key provider and cookie-authenticated cloud path', async () => {
  const calls: { url: string; options: any }[] = [];
  const context: any = {
    self: { addEventListener() {} }, console, URL, Date, Math, Promise, setTimeout, clearTimeout,
    fetch: async (url: string, options: any) => {
      calls.push({ url, options });
      return { json: async () => url.startsWith('/api/') ? { text: 'Cloud reply' } : { candidates: [{ content: { parts: [{ text: 'Custom reply' }] } }] } };
    },
  };
  runInNewContext(readFileSync('public/sw.js', 'utf8') + '\nglobalThis.replyForTest = generateSWPersonaReply;', context);
  for (const provider of ['studio', 'custom']) {
    const reply = await context.replyForTest({ provider, customApiKey: 'test-user-key', model: 'gemini-3.5-flash-lite', chatName: 'Persona' }, [], undefined, 'hello');
    assert.equal(reply, 'Custom reply');
    assert.match(calls.at(-1)!.url, /models\/gemini-3\.5-flash-lite:generateContent\?key=test-user-key/);
  }
  assert.equal(await context.replyForTest({ provider: 'vertex', chatName: 'Persona' }, [], undefined, 'hello'), 'Cloud reply');
  assert.equal(calls.at(-1)!.url, '/api/gemini/generate');
  assert.equal(calls.at(-1)!.options.headers['x-vertex-passcode'], undefined);
  assert.equal(JSON.parse(calls.at(-1)!.options.body).passcode, undefined);
});
import { saveMedia } from '../utils/storage';

test('media save does not succeed before its transaction commits', async () => {
  const previous = globalThis.indexedDB;
  let closed = false;
  const error = new Error('Transaction aborted after put');
  const transaction: any = { error, objectStore: () => ({ put: () => {
    const request: any = {};
    queueMicrotask(() => { request.onsuccess?.(); queueMicrotask(() => transaction.onabort?.()); });
    return request;
  } }) };
  globalThis.indexedDB = { open: () => {
    const request: any = { result: { transaction: () => transaction, close: () => { closed = true; } } };
    queueMicrotask(() => request.onsuccess());
    return request;
  } } as any;
  try { await assert.rejects(saveMedia('test-media', 'data:image/png;base64,AAAA'), /aborted/); assert.equal(closed, true); }
  finally { if (previous === undefined) delete (globalThis as any).indexedDB; else globalThis.indexedDB = previous; }
});
import { getGeminiResponse } from '../services/geminiService';

test('foreground chat keeps custom-key SDK and built-in proxy routing working', async () => {
  const calls: { url: string; headers: Headers; body: any }[] = [];
  const fetchMock = mock.method(globalThis, 'fetch', async (input: any, init?: RequestInit) => {
    const url = String(input?.url || input);
    calls.push({ url, headers: new Headers(init?.headers || input?.headers), body: JSON.parse(String(init?.body || '{}')) });
    return new Response(JSON.stringify(url.startsWith('/api/') ? { text: 'Cloud fixture reply' } : { candidates: [{ content: { role: 'model', parts: [{ text: 'Custom fixture reply' }] }, finishReason: 'STOP' }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
  const controller = new AbortController();
  try {
    const base = { theme: 'dark' as const, shareUserInfo: true, selectedModel: 'gemini-3.5-flash-lite', apiKey: 'fixture-user-key', isVertexUnlocked: true };
    assert.equal(await getGeminiResponse({ name: 'Fixture' }, [{ text: 'Hello', sender: 'me' }], undefined, undefined, { ...base, aiProvider: 'studio' }, undefined, undefined, undefined, controller.signal), 'Custom fixture reply');
    assert.match(calls[0].url, /generativelanguage.googleapis.com.*gemini-3\.5-flash-lite/);
    assert.equal(calls[0].headers.get('x-goog-api-key'), 'fixture-user-key');
    assert.equal(await getGeminiResponse({ name: 'Fixture' }, [{ text: 'Hello', sender: 'me' }], undefined, undefined, { ...base, aiProvider: 'vertex' }), 'Cloud fixture reply');
    assert.equal(calls.at(-1)!.url, '/api/gemini/generate');
    assert.equal(calls.at(-1)!.headers.has('x-vertex-passcode'), false);
    assert.equal(calls.at(-1)!.body.settings.selectedModel, 'gemini-3.5-flash-lite');
  } finally { controller.abort(); fetchMock.mock.restore(); }
});
