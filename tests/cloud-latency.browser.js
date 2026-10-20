// Isolated Cloud transport regression: no real provider calls or user data.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  let requests = 0;
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', async route => {
    requests++;
    await new Promise(resolve => setTimeout(resolve, 25000));
    await route.fulfill({ json: { text: 'Thanks for waiting.' } });
  });
  await context.addInitScript(() => {
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', enableTextStacking: false }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'slow', name: 'Maya', avatar: '/favicon.svg', messages: [], voiceSettings: { frequency: 'off' } }]));
  });
  try {
    const screen = await context.newPage();
    await screen.goto(new URL(page.url()).origin);
    await screen.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
    const input = screen.getByRole('textbox', { name: 'Message', exact: true });
    await input.fill('Hi there'); await input.press('Enter');
    await screen.locator('span').filter({ hasText: /^Thanks for waiting\.$/ }).waitFor({ timeout: 35000 });
    const messages = await screen.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === 'slow').messages);
    if (requests !== 1 || messages.filter(message => message.sender === 'other').length !== 1) throw new Error('Healthy slow response was retried or replaced by a fallback');
    return 'A 25-second Cloud response arrives once, with no early timeout, duplicate request or fallback.';
  } finally { await context.close(); }
}
