import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const version = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).version;
const base = new URL(process.argv[2] || 'https://wassapyo.vercel.app');
assert.ok(base.protocol === 'https:' || (base.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(base.hostname)), 'Use HTTPS, or a local preview');
assert.ok(!base.username && !base.password, 'Do not include credentials in the URL');
let failures = 0;
async function check(path, expectedStatus, validate, init = {}) {
  try {
    const response = await fetch(new URL(path, base), { ...init, redirect: 'error', signal: AbortSignal.timeout(15000) });
    assert.equal(response.status, expectedStatus, `HTTP ${response.status}, expected ${expectedStatus}`);
    await validate?.(response);
    console.log(`PASS ${path}`);
  } catch (error) { failures++; console.error(`FAIL ${path}: ${error.message}`); }
}
await check('/', 200, async response => {
  assert.ok((await response.text()).includes(`<title>Wassap v${version}</title>`), `Expected v${version}; deployment may still be updating`);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(response.headers.get('x-frame-options'), 'DENY');
  assert.ok(response.headers.get('content-security-policy')?.includes("object-src 'none'"), 'Missing production CSP');
});
await check('/manifest.json', 200, async response => {
  const manifest = await response.json(); assert.equal(manifest.name, `Wassap v${version}`); assert.equal(manifest.id, '/');
});
await check('/sw.js', 200, async response => { assert.match(await response.text(), /wassap-shell-v23/); });
await check('/sounds/ringback.wav', 200, async response => { assert.equal(Buffer.from(await response.arrayBuffer()).toString('ascii', 0, 4), 'RIFF'); });
await check('/api/gemini/status', 200, async response => {
  const status = await response.json(); assert.equal(status.status, 'online'); assert.equal(status.hasCredentials, undefined, 'Public health leaks deployment details');
});
await check('/api/gemini/auth', 401, response => assert.match(response.headers.get('cache-control') || '', /no-store/));
await check('/api/gemini/live', 401);
for (const route of ['generate', 'diary', 'tts', 'voices', 'image-generate', 'image-synthesize', 'image-excuse']) {
  await check(`/api/gemini/${route}`, 401, undefined, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base.origin }, body: '{}' });
}
await check('/api/gemini/auth', 403, undefined, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: 'https://untrusted.invalid' }, body: '{}' });
console.log(`${failures ? 'NOT READY' : 'PASS'}: v${version} deployment smoke checks. Member unlock and a real call still require an authenticated browser check.`);
process.exitCode = failures ? 1 : 0;
