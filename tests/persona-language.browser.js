async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  let voiceRequest; let previewRequest; let diaryRequest;
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', route => { previewRequest = route.request().postDataJSON(); return route.fulfill({ json: { text: 'Bonjour, je suis Tom.' } }); });
  await context.route('**/api/gemini/diary', route => { diaryRequest = route.request().postDataJSON(); return route.fulfill({ json: { text: 'Je me souviens de notre conversation.' } }); });
  await context.route('**/api/gemini/tts', route => {
    voiceRequest = route.request().postDataJSON();
    const wav = Buffer.alloc(44 + 4800); wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8); wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(24000, 24); wav.writeUInt32LE(48000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write('data', 36); wav.writeUInt32LE(4800, 40);
    return route.fulfill({ json: { audioData: `data:audio/wav;base64,${wav.toString('base64')}` } });
  });
  await context.addInitScript(() => {
    if (localStorage.getItem('language-fixture')) return;
    localStorage.setItem('language-fixture', 'yes');
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark' }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'tom', name: 'Tom', speechStyle: 'English accent', messages: [{ id: 'old', sender: 'other', text: 'The update is ready.', date: '2026-10-19', timestamp: '12:00' }] }, { id: 'maya', name: 'Maya', messages: [] }]));
  });
  try {
    const screen = await context.newPage(); screen.setDefaultTimeout(10000); await screen.goto(origin);
    const open = async name => {
      await screen.getByRole('button', { name: `Open chat with ${name}`, exact: true }).click();
      await screen.getByRole('heading', { name, exact: true, level: 2 }).click();
    };
    const profile = screen.locator('[data-app-panel="Contact info"]');
    const field = profile.getByRole('textbox', { name: 'Language', exact: true });
    await open('Tom');
    if (await field.inputValue() !== '') throw new Error('Legacy persona did not start on Auto');
    await field.fill('French');
    await field.scrollIntoViewIfNeeded();
    await screen.setViewportSize({ width: 320, height: 700 });
    await field.scrollIntoViewIfNeeded();
    if (await screen.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Language field overflows a narrow phone');
    await screen.screenshot({ path: 'output/playwright/persona-language.png' });
    await profile.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await screen.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === 'tom').language === 'French');
    await screen.waitForFunction(async () => { const saved = await (await caches.open('wassap-persona-settings')).match('/__persona_language/tom'); return saved && (await saved.json()).language === 'French'; });
    await screen.reload(); await open('Tom');
    if (await field.inputValue() !== 'French') throw new Error('Language lost on reload');
    await screen.evaluate(() => { const create = URL.createObjectURL; URL.createObjectURL = blob => { window.__personaExport = blob; return create(blob); }; });
    await profile.getByRole('button', { name: 'Export Persona Backup', exact: true }).click();
    const backup = await screen.evaluate(async () => JSON.parse(await window.__personaExport.text()));
    if (backup.persona.language !== 'French') throw new Error('Backup omitted selected language');
    await profile.getByRole('heading', { name: 'Voice Settings', exact: true }).click();
    await profile.getByRole('button', { name: 'Preview', exact: true }).click();
    for (let i = 0; !voiceRequest && i < 60; i++) await new Promise(resolve => setTimeout(resolve, 50));
    if (previewRequest?.responder.language !== 'French' || voiceRequest?.language !== 'French' || voiceRequest?.text !== 'Bonjour, je suis Tom.') throw new Error('Voice preview used hardcoded English or lost language preference');
    await profile.getByRole('button', { name: 'Close', exact: true }).click();
    await screen.locator('button[title="Save this day as a diary memory"]').first().click();
    await screen.getByRole('button', { name: 'Generate AI Diary', exact: true }).click();
    await screen.waitForFunction(() => document.querySelector('textarea[rows="6"]')?.value === 'Je me souviens de notre conversation.');
    if (diaryRequest?.persona.language !== 'French') throw new Error('Diary editor omitted saved persona language');
    await screen.getByRole('button', { name: 'Close diary', exact: true }).click();
    await screen.getByRole('heading', { name: 'Tom', exact: true, level: 2 }).click();
    await field.fill(''); await profile.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await screen.waitForFunction(async () => { const saved = await (await caches.open('wassap-persona-settings')).match('/__persona_language/tom'); return saved && (await saved.json()).language === ''; });
    await profile.getByRole('button', { name: 'Close', exact: true }).click();
    await screen.getByRole('button', { name: 'Back to chats', exact: true }).click();
    await open('Maya');
    if (await field.inputValue() !== '') throw new Error('Another persona inherited the language');
    return 'Persona Language defaults to Auto, fits 320px, saves/reloads French, clears back to Auto and stays independent; worker override cache follows saves.';
  } finally { await context.close(); }
}
