/**
 * Audio utilities for AI Voice Notes (gemini-3.1-flash-tts-preview)
 */

/**
 * Strips all emoji characters, variation selectors, and pictographs from voice transcripts and speech inputs.
 */
export function stripEmojis(text: string): string {
  if (!text) return '';
  return text
    .replace(/[\p{Extended_Pictographic}\uFE0F\u200D\u20E3]/gu, '')
    .replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}]/gu, '')
    .replace(/\s+([.,!?;:])/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Strips bracketed emotional cues, vocal tags, and emojis from persona responses so visible text previews
 * and voice note transcripts read naturally and cleanly in the UI without emojis or leaked stage directions.
 */
export function cleanSpokenTranscript(text: string): string {
  if (!text) return '';
  const withoutCues = text
    // Replace bracketed/asterisked/parenthesized audio, emotional, and delivery cues
    .replace(/[\[\*(](?:scoffs?|scoffing|whispers?|whispering|sighs?|sighing|laughs?|laughing|chuckles?|chuckling|giggles?|giggling|gasps?|gasping|excited(?:ly)?|pauses?|pause|crying|groans?|groaning|yells?|yelling|shouts?|shouting|snickers?|snickering|clears?\s+throat|throat-clearing|smiling|smirks?|smirking|sarcastically|grunts?|grunting|snorts?|snorting|yawns?|yawning|coughs?|coughing|pants?|panting|screams?|screaming|sobs?|sobbing|wheezes?|wheezing|softly|loudly|cheerfully|angrily|nervously|hesitantly|teasing|playfully)[^\]\*\)]*[\]\*)]/gi, '')
    // Clean inline vocal tags like <laugh>, <sigh>, <gasp>, <whisper>, </whisper>, <snort>, <yawn>, <cough>, etc.
    .replace(/<(?:\/?[a-zA-Z_-]+)[^>]*>/gi, '')
    // Clean any lingering generic short bracket cues like [sarcastic] or [soft chuckle] that might leak into transcript
    .replace(/\[[a-zA-Z\s_-]{2,30}\]/g, '');

  return stripEmojis(withoutCues);
}

/**
 * Converts bracketed emotional expressions (e.g., [laughs], [sighs], [scoffs], [whispers]) into native Gemini 3.8 TTS vocal burst tags
 * (e.g., <laugh>, <sigh>, <gasp>, <cough>, <whisper>). Also strips unpronounceable bracket directions and all emojis so the TTS
 * voice engine never reads emoji names aloud.
 */
export function convertToGeminiVocalTags(text: string): string {
  if (!text) return '';
  const converted = text
    .replace(/[\[\*(](?:laughs?|laughing|chuckles?|chuckling|giggles?|giggling|snickers?|snickering)[\]\*)]/gi, '<laugh>')
    .replace(/[\[\*(](?:sighs?|sighing|scoffs?|scoffing)[\]\*)]/gi, '<sigh>')
    .replace(/[\[\*(](?:gasps?|gasping)[\]\*)]/gi, '<gasp>')
    .replace(/[\[\*(](?:coughs?|coughing)[\]\*)]/gi, '<cough>')
    .replace(/[\[\*(](?:groans?|groaning|grunts?|grunting)[\]\*)]/gi, '<groan>')
    .replace(/[\[\*(](?:clears?\s+throat|throat-clearing)[\]\*)]/gi, '<throat-clearing>')
    .replace(/[\[\*(](?:yawns?|yawning)[\]\*)]/gi, '<yawn>')
    .replace(/[\[\*(](?:snorts?|snorting)[\]\*)]/gi, '<snort>')
    .replace(/[\[\*(](?:pants?|panting)[\]\*)]/gi, '<pant>')
    .replace(/[\[\*(](?:whispers?|whispering|softly)[\]\*)]/gi, '<whisper>')
    .replace(/[\[\*(](?:pauses?|pause|short pause)[\]\*)]/gi, ' ... ')
    // Strip any remaining bracketed or asterisked acting cues that are not pronounceable vocal bursts
    .replace(/\[[a-zA-Z\s_-]{2,30}\]/g, '')
    .replace(/\*[a-zA-Z\s_-]{2,30}\*/g, '');

  return stripEmojis(converted);
}

/**
 * Formats time in seconds into m:ss format (e.g., 0:14 or 1:05).
 */
export function formatAudioDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generates an array of normalized bar heights (0.15 to 1.0) for the audio waveform visualization.
 * Uses a deterministic hash of the seed string so bars remain consistent for a given audio message.
 */
export function generateWaveformBars(seed: string | number, count = 36): number[] {
  const str = String(seed || 'wassap-voice');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }

  const bars: number[] = [];
  for (let i = 0; i < count; i++) {
    // Deterministic pseudo-random number between 0.15 and 0.95
    const x = Math.sin(hash + i * 1.618) * 10000;
    const rand = x - Math.floor(x);
    // Add natural speech cadence (peaks and valleys)
    const cadence = 0.3 + 0.6 * Math.abs(Math.sin((i / count) * Math.PI * 3 + (hash % 10)));
    const height = Math.min(Math.max(0.18, (rand * 0.5 + cadence * 0.5)), 0.95);
    bars.push(parseFloat(height.toFixed(2)));
  }
  return bars;
}

/**
 * Converts raw 16-bit linear PCM base64 data to a WAV data URL with a standard 44-byte RIFF/WAVE header.
 * This allows raw PCM returned by Gemini TTS preview models to be natively decoded and played by HTML5 Audio elements.
 */
export function pcmBase64ToWavDataUrl(
  pcmBase64: string,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): string {
  // If it's already a full data URI or WAV/MP3, return directly
  if (pcmBase64.startsWith('data:audio/')) {
    return pcmBase64;
  }

  // Gemini 3.8 returns a native 24kHz WAV with a 44-byte RIFF header (base64 begins with 'UklGR')
  if (pcmBase64.startsWith('UklGR')) {
    return `data:audio/wav;base64,${pcmBase64}`;
  }

  // If environment has Buffer (Node.js / server-side)
  if (typeof Buffer !== 'undefined') {
    try {
      const pcmBuffer = Buffer.from(pcmBase64, 'base64');
      const dataSize = pcmBuffer.length;
      const header = Buffer.alloc(44);

      header.write('RIFF', 0);
      header.writeUInt32LE(36 + dataSize, 4);
      header.write('WAVE', 8);
      header.write('fmt ', 12);
      header.writeUInt32LE(16, 16); // Subchunk1Size
      header.writeUInt16LE(1, 20);  // AudioFormat (1 = PCM)
      header.writeUInt16LE(numChannels, 22);
      header.writeUInt32LE(sampleRate, 24);
      header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
      header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
      header.writeUInt16LE(bitsPerSample, 34);
      header.write('data', 36);
      header.writeUInt32LE(dataSize, 40);

      const wavBuffer = Buffer.concat([header, pcmBuffer]);
      return `data:audio/wav;base64,${wavBuffer.toString('base64')}`;
    } catch (err) {
      console.warn('Server PCM conversion fallback:', err);
    }
  }

  // Browser-compatible base64 to WAV converter
  try {
    const binaryString = typeof atob === 'function' ? atob(pcmBase64) : '';
    const pcmLength = binaryString.length;
    const buffer = new ArrayBuffer(44 + pcmLength);
    const view = new DataView(buffer);

    // RIFF identifier
    view.setUint8(0, 0x52); // R
    view.setUint8(1, 0x49); // I
    view.setUint8(2, 0x46); // F
    view.setUint8(3, 0x46); // F
    view.setUint32(4, 36 + pcmLength, true); // file length - 8
    // WAVE identifier
    view.setUint8(8, 0x57);  // W
    view.setUint8(9, 0x41);  // A
    view.setUint8(10, 0x56); // V
    view.setUint8(11, 0x45); // E
    // fmt subchunk
    view.setUint8(12, 0x66); // f
    view.setUint8(13, 0x6d); // m
    view.setUint8(14, 0x74); // t
    view.setUint8(15, 0x20); // ' '
    view.setUint32(16, 16, true); // Subchunk1Size
    view.setUint16(20, 1, true);  // AudioFormat (1 = PCM)
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    // data subchunk
    view.setUint8(36, 0x64); // d
    view.setUint8(37, 0x61); // a
    view.setUint8(38, 0x74); // t
    view.setUint8(39, 0x61); // a
    view.setUint32(40, pcmLength, true);

    const uint8 = new Uint8Array(buffer);
    for (let i = 0; i < pcmLength; i++) {
      uint8[44 + i] = binaryString.charCodeAt(i);
    }

    let binary = '';
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return `data:audio/wav;base64,${btoa(binary)}`;
  } catch (e) {
    console.error('Failed to convert PCM to WAV data URL:', e);
    return `data:audio/wav;base64,${pcmBase64}`;
  }
}
