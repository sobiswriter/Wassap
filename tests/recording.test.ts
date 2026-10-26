import assert from 'node:assert/strict';
import { test, mock } from 'node:test';
import { createMicrophoneRecorder } from '../utils/audio';

test('recordings request unprocessed full-band audio and a high-quality encoder without forcing a codec', async () => {
  const stop = mock.fn();
  const stream = { getTracks: () => [{ stop }] };
  const capture = mock.fn(async (_constraints: MediaStreamConstraints) => stream);
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  const previousRecorder = globalThis.MediaRecorder;
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: capture } } });
  let fail = false;
  globalThis.MediaRecorder = class {
    constructor(public stream: unknown, public options: unknown) { if (fail) throw new Error('encoder unavailable'); }
  } as any;
  try {
    const recorder = await createMicrophoneRecorder() as any;
    assert.equal(recorder.stream, stream);
    assert.deepEqual(capture.mock.calls[0].arguments[0], { audio: { sampleRate: { ideal: 48000 }, channelCount: { ideal: 1 }, echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    assert.deepEqual(recorder.options, { audioBitsPerSecond: 192000 });
    assert.equal(stop.mock.callCount(), 0);
    fail = true;
    await assert.rejects(createMicrophoneRecorder(), /encoder unavailable/);
    assert.equal(stop.mock.callCount(), 1, 'An encoder failure must release the microphone');
  } finally {
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator);
    else Reflect.deleteProperty(globalThis, 'navigator');
    if (previousRecorder) globalThis.MediaRecorder = previousRecorder;
    else Reflect.deleteProperty(globalThis, 'MediaRecorder');
  }
});
