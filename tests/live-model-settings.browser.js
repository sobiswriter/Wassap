// Settings persistence and resumed Cloud setup, with synthetic microphone/transport only.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  const starts = []; const sockets = [];
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.routeWebSocket('**/api/gemini/live', socket => {
    sockets.push(socket);
    socket.onMessage(raw => {
      if (typeof raw !== 'string') return;
      const data = JSON.parse(raw);
      if (data.type !== 'start') return;
      starts.push(data); socket.send(JSON.stringify({ setupComplete: {} }));
      socket.send(JSON.stringify({ sessionResumptionUpdate: { newHandle: 'same-voice-resume', resumable: true } }));
    });
  });
  await context.addInitScript(() => {
    if (!localStorage.getItem('model-fixture')) {
      localStorage.setItem('model-fixture', 'yes');
      localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', selectedVoiceModel: 'gemini-3.8-flash-tts' }));
      localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'call', name: 'Maya', avatar: '/favicon.svg', about: 'A thoughtful friend', voiceSettings: { voiceName: 'Fenrir', pitchTone: 'very high' }, messages: [] }]));
    }
    Object.defineProperty(navigator.mediaDevices, 'getUserMedia', { value: async () => {
      const audio = new AudioContext(); const dest = audio.createMediaStreamDestination(); window.__fixtureAudio = audio; return dest.stream;
    } });
  });
  try {
    const screen = await context.newPage(); screen.setDefaultTimeout(15000); await screen.goto(origin);
    await screen.getByRole('button', { name: 'Settings', exact: true }).click();
    const select = screen.getByRole('combobox', { name: 'Live Call Model', exact: true });
    if (await select.inputValue() !== 'gemini-3.8-live') throw new Error('Legacy settings lost the normal Live default');
    if (await select.locator('option').count() !== 2) throw new Error('Expected exactly the two documented Live models');
    await select.selectOption('gemini-3.8-live-extended-thinking');
    await screen.setViewportSize({ width: 320, height: 700 }); await select.scrollIntoViewIfNeeded();
    if (await screen.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Live model selector overflows phone');
    await screen.screenshot({ path: 'output/playwright/live-model-settings.png' });
    await screen.getByRole('button', { name: 'Save Settings', exact: true }).click();
    await screen.reload(); await screen.getByRole('button', { name: 'Settings', exact: true }).click();
    if (await select.inputValue() !== 'gemini-3.8-live-extended-thinking') throw new Error('Live model not preserved after reload');
    await screen.getByRole('button', { name: 'Save Settings', exact: true }).click();
    await screen.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    await screen.clock.install(); await screen.getByRole('button', { name: 'Voice call', exact: true }).click();
    await screen.waitForFunction(() => document.querySelector('.call-status')?.textContent === 'Ringing…');
    await screen.clock.runFor(12050);
    await screen.waitForFunction(() => /^\d+:\d{2}$/.test(document.querySelector('.call-status')?.textContent || ''));
    if (starts[0].model !== 'gemini-3.8-live-extended-thinking' || starts[0].voice !== 'Fenrir' || starts[0].prompt.includes('very high')) throw new Error('Call ignored model or kept conflicting voice pitch');
    sockets[0].close({ code: 1012, reason: 'Synthetic reconnect' });
    await screen.waitForFunction(() => document.querySelector('.call-status')?.textContent === 'Reconnecting…');
    await screen.clock.runFor(1250);
    await screen.waitForFunction(() => /^\d+:\d{2}$/.test(document.querySelector('.call-status')?.textContent || ''));
    if (starts.length !== 2 || starts[1].resume !== 'same-voice-resume' || starts[1].voice !== starts[0].voice || starts[1].model !== starts[0].model || starts[1].prompt !== starts[0].prompt) throw new Error('Resumption changed voice/model/prompt');
    await screen.getByRole('button', { name: 'End call', exact: true }).click();
    await screen.evaluate(() => window.__fixtureAudio.close());
    return 'Live model selector defaults/persists/fits phone; Cloud Extended Thinking and session resumption keep Fenrir and identical prompt/model.';
  } finally { await context.close(); }
}
