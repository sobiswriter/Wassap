import test from 'node:test';
import assert from 'node:assert/strict';
import { createZipArchive, computeCRC32, dataUrlToUint8Array } from '../utils/zip';

test('computeCRC32 produces standard CRC values', () => {
  const hello = new TextEncoder().encode('Hello World');
  const crc = computeCRC32(hello);
  assert.equal(typeof crc, 'number');
  assert.equal(crc >>> 0, 0x4A17B156);
});

test('createZipArchive produces valid zip buffer with PK headers', () => {
  const entries = [
    { name: 'test.txt', data: 'Hello from test!' },
    { name: 'audio/sample.wav', data: new Uint8Array([82, 73, 70, 70, 0, 0, 0, 0]) }
  ];
  const zipBytes = createZipArchive(entries);
  assert.equal(zipBytes instanceof Uint8Array, true);
  assert.ok(zipBytes.length > 50);

  // Check PK\x03\x04 signature at offset 0
  assert.equal(zipBytes[0], 0x50); // 'P'
  assert.equal(zipBytes[1], 0x4B); // 'K'
  assert.equal(zipBytes[2], 0x03);
  assert.equal(zipBytes[3], 0x04);
});

test('dataUrlToUint8Array parses base64 and data URLs correctly', () => {
  const dataUrl = 'data:text/plain;base64,SGVsbG8=';
  const bytes = dataUrlToUint8Array(dataUrl);
  const text = new TextDecoder().decode(bytes);
  assert.equal(text, 'Hello');
});
