import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveWallpaperUrl, getWallpaperSize } from '../utils/wallpaper';

test('mobile wallpaper keeps its crop through keyboard and composer resizing', () => {
  const expanded = { width: 390, height: 844 };
  assert.deepEqual(getWallpaperSize(expanded, { width: 390, height: 480 }, true), expanded);
  assert.deepEqual(getWallpaperSize(expanded, { width: 390, height: 790 }, true), expanded);
  assert.deepEqual(getWallpaperSize(expanded, { width: 390, height: 900 }, true), { width: 390, height: 900 });
  assert.deepEqual(getWallpaperSize(expanded, { width: 844, height: 390 }, true), { width: 844, height: 390 });
  assert.deepEqual(getWallpaperSize(expanded, { width: 390, height: 480 }, false), { width: 390, height: 480 });
});

test('retired wallpaper resolves without changing stored or custom values', () => {
  const stored = { wallpaper: 'https://images.unsplash.com/photo-1511497584788-87676104235f?auto=format&fit=crop&w=1200&q=80' };
  assert.equal(resolveWallpaperUrl(stored.wallpaper), '/images/misty-forest.svg');
  assert.match(stored.wallpaper, /^https:/);
  for (const custom of ['data:image/png;base64,c2FtcGxl', 'https://example.com/my-wallpaper.png', '/images/dark.png', 'default']) {
    assert.equal(resolveWallpaperUrl(custom), custom);
  }
});
