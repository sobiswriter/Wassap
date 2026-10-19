// Switching chats while generation is pending must never carry a diary across personas.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 1000, height: 850 } });
  let pending; const payloads = [];
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/diary', route => { payloads.push(route.request().postDataJSON()); pending = route; });
  await context.addInitScript(() => {
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark' }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([
      { id: 'tom', name: 'Tommy', speechStyle: 'African English accent; relaxed English', messages: [{ id: 'tom-line', sender: 'other', senderName: 'Tommy', text: 'The main update is done. The game is ready.', date: '2026-10-19', timestamp: '12:00' }] },
      { id: 'maya', name: 'Maya', speechStyle: 'Natural Hinglish', messages: [{ id: 'maya-line', sender: 'other', senderName: 'Maya', text: 'Haan yaar, kal milte hain.', date: '2026-10-19', timestamp: '12:01' }] },
    ]));
  });
  try {
    const screen = await context.newPage(); screen.setDefaultTimeout(15000); await screen.goto(origin);
    await screen.getByRole('button', { name: /^Open chat with Tommy/ }).click();
    await screen.locator('button[title="Save this day as a diary memory"]').first().click();
    await screen.getByRole('button', { name: 'Generate AI Diary', exact: true }).click();
    for (let i = 0; !pending && i < 50; i++) await new Promise(resolve => setTimeout(resolve, 50));
    if (!pending || payloads[0].persona.name !== 'Tommy') throw new Error('Wrong diary author requested');
    await screen.evaluate(() => navigator.serviceWorker.dispatchEvent(new MessageEvent('message', { data: { type: 'OPEN_CHAT', chatId: 'maya' } })));
    await screen.getByRole('heading', { name: "Tommy's Diary", exact: true }).waitFor({ state: 'hidden' });
    await pending.fulfill({ json: { text: 'Tommy-only private thoughts about our game.' } });
    await screen.locator('button[title="Save this day as a diary memory"]').first().click();
    await screen.getByRole('heading', { name: "Maya's Diary", exact: true }).waitFor();
    if (await screen.locator('textarea[rows="6"]').inputValue()) throw new Error('Previous persona diary leaked into new editor');
    await screen.getByRole('button', { name: 'Generate AI Diary', exact: true }).click();
    for (let i = 0; payloads.length < 2 && i < 50; i++) await new Promise(resolve => setTimeout(resolve, 50));
    if (payloads[1]?.persona.name !== 'Maya' || payloads[1].messageHistory.some(message => message.text.includes('main update'))) throw new Error('New diary used another persona history');
    await pending.fulfill({ json: { text: 'Maya-only private thoughts.' } });
    await screen.waitForFunction(() => document.querySelector('textarea[rows="6"]')?.value === 'Maya-only private thoughts.');
    await screen.getByRole('button', { name: "Save to Persona's Diary", exact: true }).click();
    await screen.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === 'maya').memoryBubbles?.length === 1);
    const chats = await screen.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats')));
    if (chats.find(chat => chat.id === 'tom').memoryBubbles?.length) throw new Error('Diary saved to another owner');
    const memory = chats.find(chat => chat.id === 'maya').memoryBubbles[0];
    if (memory.chatId !== 'maya' || !memory.summary.includes('Maya-only private thoughts.') || memory.summary.includes('Tommy-only')) throw new Error('Saved diary contains another persona draft');
    return 'Pending Tommy generation cannot survive chat switch; Maya opens a clean editor and sends only her own profile/history.';
  } finally { await context.close(); }
}
