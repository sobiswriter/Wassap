// Recover a transient provider failure inside one recording flow, with no tick reversal.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  let requests = 0; let voiceRequest;
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', route => { requests++; return requests === 1 ? route.fulfill({ status: 503, json: { error: 'Temporary failure' } }) : route.fulfill({ json: { text: 'I will bring the pictures tomorrow.' } }); });
  await context.route('**/api/gemini/tts', route => { voiceRequest = route; });
  await context.addInitScript(() => {
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', enableTextStacking: false }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'voice-flow', name: 'Maya', avatar: '/favicon.svg', status: 'offline', messages: [], voiceSettings: { frequency: 'always', voiceName: 'Aoede', voiceForVoice: true } }]));
  });
  try {
    await page.goto(origin); await page.getByRole('button', { name: /^Open chat with Maya/ }).click();
    await page.getByRole('textbox', { name: 'Message', exact: true }).fill('Bring the pictures.');
    await page.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
    await page.waitForFunction(() => document.querySelector('.chat-presence')?.textContent?.includes('recording'));
    for (let i = 0; i < 30 && !voiceRequest; i++) await new Promise(resolve => setTimeout(resolve, 100));
    if (!voiceRequest || requests !== 2) throw new Error('Provider did not recover within the same turn');
    await page.clock.install(); await page.clock.runFor(4000);
    if (!await page.locator('.chat-presence').innerText().then(text => text.includes('recording'))) throw new Error('Recording flow went offline during recovery');
    if (await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.find(m => m.sender === 'me').status === 'pending')) throw new Error('Read/delivered ticks reversed to unsent');
    const wav = Buffer.alloc(44 + 4800); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4800, 40);
    await voiceRequest.fulfill({ json: { audioData: `data:audio/wav;base64,${wav.toString('base64')}` } });
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.some(m => m.sender === 'other'));
    await page.clock.runFor(70000);
    const messages = await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages);
    if (requests !== 2 || messages.filter(m => m.sender === 'other').length !== 1 || messages.some(m => m.status === 'pending')) throw new Error('The completed turn restarted or duplicated');
    await page.setViewportSize({ width: 320, height: 540 });
    await page.locator('.message-composer input[type="file"][accept="image/*"]').last().setInputFiles({ name: 'caption.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cF9sAAAAASUVORK5CYII=', 'base64') });
    await page.getByPlaceholder('Add somethin..', { exact: true }).waitFor();
    if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Caption composer overflows narrow viewport');
    return 'Transient generation failure recovers inside one recording flow; ticks never reverse and no later delivery attempt restarts it.';
  } finally { await context.close(); }
}
