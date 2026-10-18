// Synthetic voice samples and mocked transport; no real recordings or provider requests.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' });
  page = await context.newPage();
  const starts = [];
  await context.route('**/api/gemini/live', route => route.fulfill({ json: { summary: 'A previous call ended.' } }));
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.routeWebSocket('**/api/gemini/live', socket => socket.onMessage(raw => {
    if (typeof raw !== 'string') return;
    const data = JSON.parse(raw);
    if (data.type === 'start') { starts.push(data); socket.send(JSON.stringify({ setupComplete: {} })); }
  }));
  await context.addInitScript(() => {
    const kind = sessionStorage.getItem('voiceKind') || 'designed';
    const duration = kind === 'short' ? 2 : 12;
    const samples = duration * 24000;
    const bytes = new Uint8Array(44 + samples * 2); const view = new DataView(bytes.buffer);
    view.setUint32(0, 0x52494646); view.setUint32(4, bytes.length - 8, true); view.setUint32(8, 0x57415645);
    view.setUint32(12, 0x666d7420); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, 24000, true); view.setUint32(28, 48000, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    view.setUint32(36, 0x64617461); view.setUint32(40, samples * 2, true);
    for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, Math.sin(i / 10) * 8000, true);
    let binary = ''; for (const byte of bytes) binary += String.fromCharCode(byte);
    const sampleAudioDataUrl = `data:audio/wav;base64,${btoa(binary)}`;
    localStorage.setItem('wassap_custom_voices', JSON.stringify([{ id: 'voice_test', name: 'Custom test', type: kind === 'replicated' ? 'replicated' : 'designed', model: 'gemini-3.8-flash-tts', createdAt: Date.now(), promptDescription: 'soft British voice', sampleAudioDataUrl: kind === 'missing' ? undefined : sampleAudioDataUrl }]));
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'light' }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'test', name: 'Maya', avatar: '/favicon.svg', about: 'Friend', status: 'offline', messages: [],
      voiceSettings: { voiceName: 'Fenrir', enableVoiceDesign: kind !== 'replicated', designedVoiceId: 'voice_test', enableVoiceReplication: kind === 'replicated', replicatedVoiceId: 'voice_test' } }]));
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const ctx = new AudioContext(); const dest = ctx.createMediaStreamDestination(); window.fixtureAudio = ctx; return dest.stream;
    } });
  });
  try {
    await page.clock.install();
    for (const kind of ['designed', 'replicated', 'short', 'missing']) {
      if (kind === 'designed') await page.goto(origin);
      else { await page.evaluate(kind => sessionStorage.setItem('voiceKind', kind), kind); await page.reload(); }
      await page.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
      await page.getByRole('button', { name: 'Voice call', exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.call-status')?.textContent === 'Ringing…');
      await page.clock.runFor(12050);
      await page.waitForFunction(() => /^\d+:\d{2}$/.test(document.querySelector('.call-status')?.textContent || ''));
      const request = starts.at(-1);
      if (kind === 'designed' || kind === 'replicated') {
        if (Buffer.from(request.voiceSample || '', 'base64').length !== 12 * 24000 * 2) throw new Error(`${kind}: custom sample missing or WAV header not removed`);
        await page.getByText(/Using your custom voice sample/).waitFor();
      } else {
        if (request.voiceSample || request.voice !== 'Fenrir') throw new Error(`${kind}: invalid sample was transmitted or wrong fallback selected`);
        await page.getByText(/Call fallback: Fenrir/).waitFor();
      }
      if (!request.prompt.includes('custom vocal design: soft British voice')) throw new Error('Designed style missing');
      await page.getByRole('button', { name: 'End call', exact: true }).click();
      await page.getByRole('button', { name: 'Return to chat', exact: true }).click();
      await page.evaluate(() => window.fixtureAudio.close());
    }
    return 'Designed/replicated samples convert to 24 kHz mono PCM; short/missing previews use explicit persona fallback.';
  } finally { await context.close(); }
}
