// Real browser encoder with a synthetic tone, isolated storage, and no physical microphone.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.addInitScript(() => {
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'maya', name: 'Maya', avatar: '/favicon.svg', messages: [], voiceSettings: { frequency: 'off' } }]));
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async constraints => {
      window.__micConstraints = constraints;
      const audio = new AudioContext({ sampleRate: 48000 });
      await audio.resume();
      const tone = audio.createOscillator(); tone.frequency.value = 1000;
      const gain = audio.createGain(); gain.gain.value = 0.2;
      const destination = audio.createMediaStreamDestination();
      tone.connect(gain).connect(destination); tone.start();
      window.__micAudio = audio;
      return destination.stream;
    } });
    const Recorder = MediaRecorder;
    window.MediaRecorder = class extends Recorder {
      constructor(stream, options) { super(stream, options); window.__recorder = this; }
    };
    const Reader = FileReader;
    window.FileReader = class extends Reader {
      readAsDataURL(blob) { window.__recordingBlob = blob; super.readAsDataURL(blob); }
    };
  });
  const screen = await context.newPage();
  try {
    await screen.goto(new URL(page.url()).origin);
    await screen.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    await screen.getByTitle('Record voice note', { exact: true }).click();
    await screen.getByTitle('Attach voice note', { exact: true }).waitFor();
    await screen.waitForTimeout(650);
    await screen.getByTitle('Attach voice note', { exact: true }).click();
    await screen.getByText('Audio attached', { exact: true }).waitFor();
    const result = await screen.evaluate(async () => {
      const blob = window.__recordingBlob;
      const decoded = await window.__micAudio.decodeAudioData(await blob.arrayBuffer());
      const samples = decoded.getChannelData(0);
      const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
      const result = { constraints: window.__micConstraints.audio, bitrate: window.__recorder.audioBitsPerSecond, mime: blob.type, recorderMime: window.__recorder.mimeType, duration: decoded.duration, rms, stopped: window.__recorder.stream.getTracks().every(track => track.readyState === 'ended') };
      await window.__micAudio.close();
      return result;
    });
    if (result.constraints.sampleRate?.ideal !== 48000 || result.constraints.echoCancellation !== false || result.constraints.noiseSuppression !== false || result.constraints.autoGainControl !== false) throw new Error('Recording used speech-processing defaults');
    if (result.bitrate !== 192000 || result.mime !== result.recorderMime || result.duration < 0.3 || result.rms < 0.05 || !result.stopped) throw new Error(JSON.stringify(result));
    return result;
  } finally { await context.close(); }
}
