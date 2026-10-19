// A closed profile's detached or pending preview must not speak over a call.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  let requests = 0; let pending;
  const wav = Buffer.alloc(44 + 10 * 24000 * 2); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
  const audio = { audioData: `data:audio/wav;base64,${wav.toString('base64')}` };
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', route => route.fulfill({ json: { text: 'Hello, I am Maya.' } }));
  await context.route('**/api/gemini/tts', route => { requests++; if (requests === 1) return route.fulfill({ json: audio }); pending = route; });
  await context.addInitScript(() => {
    const NativeAudio = window.Audio; window.__previews = [];
    window.Audio = function(src) { const audio = new NativeAudio(src); if (src?.startsWith('data:audio')) window.__previews.push(audio); return audio; };
    window.Audio.prototype = NativeAudio.prototype;
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark' }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'maya', name: 'Maya', avatar: '/favicon.svg', messages: [], voiceSettings: { voiceName: 'Fenrir' } }]));
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => { const audio = new AudioContext(); window.__fixtureAudio = audio; return audio.createMediaStreamDestination().stream; } });
  });
  try {
    const screen = await context.newPage(); screen.setDefaultTimeout(15000); await screen.goto(origin);
    await screen.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    const profile = screen.locator('[data-app-panel="Contact info"]');
    const preview = async () => {
      await screen.getByRole('heading', { name: 'Maya', level: 2, exact: true }).click();
      await profile.getByRole('heading', { name: 'Voice Settings', exact: true }).click();
      await profile.getByRole('button', { name: 'Preview', exact: true }).click();
    };
    await preview();
    await screen.waitForFunction(() => window.__previews.length === 1 && !window.__previews[0].paused);
    await profile.getByRole('button', { name: 'Close', exact: true }).click();
    await screen.waitForFunction(() => window.__previews[0].paused);
    await preview();
    for (let i = 0; !pending && i < 50; i++) await new Promise(resolve => setTimeout(resolve, 50));
    if (!pending) throw new Error('Preview generation was not started');
    await profile.getByRole('button', { name: 'Close', exact: true }).click();
    await screen.getByRole('button', { name: 'Voice call', exact: true }).click();
    await screen.waitForFunction(() => document.querySelector('.call-status')?.textContent === 'Ringing…');
    await pending.fulfill({ json: audio });
    await screen.waitForTimeout(300);
    if (await screen.evaluate(() => window.__previews.length !== 1 || !window.__previews[0].paused)) throw new Error('Closed/pending preview leaked into the call');
    await screen.getByRole('button', { name: 'End call', exact: true }).click();
    await screen.evaluate(() => window.__fixtureAudio.close());
    return 'Closing profile stops detached preview; a delayed TTS response after close cannot create another player during the call.';
  } finally { await context.close(); }
}
