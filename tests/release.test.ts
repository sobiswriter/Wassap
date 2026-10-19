import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
test('release labels agree while installed-app identity stays compatible', () => {
  const pkg = JSON.parse(read('package.json'));
  const lock = JSON.parse(read('package-lock.json'));
  assert.equal(pkg.version, '1.9.9');
  assert.equal(lock.version, pkg.version);
  assert.equal(lock.packages[''].version, pkg.version);
  const title = `Wassap v${pkg.version}`;
  assert.ok(read('index.html').includes(`<title>${title}</title>`));
  assert.ok(read('index.html').includes(`name="apple-mobile-web-app-title" content="${title}"`));
  assert.equal(JSON.parse(read('metadata.json')).name, title);
  const manifest = JSON.parse(read('public/manifest.json'));
  assert.equal(manifest.name, title);
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.ok(read('App.tsx').includes(`document.title = '${title}'`));
  assert.ok(read('components/UpdatesPanel.tsx').includes(`version="v${pkg.version}"`));
});

test('production policy permits local voice preview conversion and blocks executable embeds', () => {
  const headers = JSON.parse(read('vercel.json')).headers[0].headers;
  const policy = headers.find((h: any) => h.key === 'Content-Security-Policy').value;
  assert.match(policy, /connect-src 'self' data: blob:/);
  assert.ok(policy.includes("object-src 'none'") && policy.includes("frame-ancestors 'none'"));
  assert.ok(!policy.includes("'unsafe-eval'"));
});
