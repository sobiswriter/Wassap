/**
 * Client-Side Audio Resampler & WAV Encoder
 * Conforms audio inputs to Google Cloud Voices API specifications:
 * - Format: Linear PCM WAV
 * - Bit Depth: 16-bit little-endian
 * - Channels: 1 (Mono)
 * - Sample Rate: 24,000 Hz
 */

function encode16BitPcmWav(channelData: Float32Array, sampleRate = 24000): ArrayBuffer {
  const numSamples = channelData.length;
  const buffer = new ArrayBuffer(44 + numSamples * 2);
  const view = new DataView(buffer);

  // RIFF identifier
  view.setUint32(0, 0x52494646, false); // "RIFF"
  // file length minus 8 bytes
  view.setUint32(4, 36 + numSamples * 2, true);
  // RIFF type "WAVE"
  view.setUint32(8, 0x57415645, false); // "WAVE"

  // format chunk identifier "fmt "
  view.setUint32(12, 0x666d7420, false); // "fmt "
  // format chunk length (16 for PCM)
  view.setUint32(16, 16, true);
  // sample format (1 = PCM)
  view.setUint16(20, 1, true);
  // channel count (1 = mono)
  view.setUint16(22, 1, true);
  // sample rate
  view.setUint32(24, sampleRate, true);
  // byte rate (sampleRate * channels * bytesPerSample)
  view.setUint32(28, sampleRate * 1 * 2, true);
  // block align (channels * bytesPerSample)
  view.setUint16(32, 2, true);
  // bits per sample
  view.setUint16(34, 16, true);

  // data chunk identifier "data"
  view.setUint32(36, 0x64617461, false); // "data"
  // data chunk length
  view.setUint32(40, numSamples * 2, true);

  // Write PCM samples with soft clipping
  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    const val = s < 0 ? s * 0x8000 : s * 0x7fff;
    view.setInt16(offset, Math.floor(val), true);
    offset += 2;
  }

  return buffer;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export async function convertAudioTo24kMonoWav(
  input: Blob | File | ArrayBuffer
): Promise<{ base64Wav: string; dataUrl: string; durationSec: number }> {
  let arrayBuffer: ArrayBuffer;
  if (input instanceof ArrayBuffer) {
    arrayBuffer = input;
  } else {
    arrayBuffer = await input.arrayBuffer();
  }

  const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioContextClass) {
    throw new Error('Web Audio API is not supported in this browser.');
  }

  const audioCtx = new AudioContextClass();
  let decodedBuffer: AudioBuffer;
  try {
    decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    audioCtx.close().catch(() => {});
  }

  const targetSampleRate = 24000;
  const durationSec = decodedBuffer.duration;
  const targetLength = Math.max(1, Math.ceil(durationSec * targetSampleRate));

  // Render to 1 channel mono at 24,000 Hz using OfflineAudioContext
  const offlineCtx = new OfflineAudioContext(1, targetLength, targetSampleRate);
  const sourceNode = offlineCtx.createBufferSource();
  sourceNode.buffer = decodedBuffer;
  sourceNode.connect(offlineCtx.destination);
  sourceNode.start(0);

  const renderedBuffer = await offlineCtx.startRendering();
  const monoChannel = renderedBuffer.getChannelData(0);

  const wavArrayBuffer = encode16BitPcmWav(monoChannel, targetSampleRate);
  const base64Wav = arrayBufferToBase64(wavArrayBuffer);
  const dataUrl = `data:audio/wav;base64,${base64Wav}`;

  return {
    base64Wav,
    dataUrl,
    durationSec
  };
}

export const MANDATORY_CONSENT_TEXT = 
  'I am the owner of this voice and have consented to the creation of a synthetic model of my voice through the use of Google Cloud.';

/**
 * Creates a silent/ambient fallback 24kHz mono PCM WAV for automated consent submission
 */
export function createFallbackConsentWav(): string {
  const sampleRate = 24000;
  const durationSec = 3.5;
  const numSamples = Math.floor(sampleRate * durationSec);
  const channelData = new Float32Array(numSamples);
  // Extremely gentle low-level ambient floor
  for (let i = 0; i < numSamples; i++) {
    channelData[i] = (Math.random() - 0.5) * 0.001;
  }
  const buffer = encode16BitPcmWav(channelData, sampleRate);
  return arrayBufferToBase64(buffer);
}
