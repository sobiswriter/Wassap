// Isolated storage and synthetic Cloud responses; no user data or paid requests.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  let requests = 0;
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', route => { requests++; return route.fulfill({ json: { text: `Synthetic reply ${requests}.` } }); });
  await context.addInitScript(() => {
    Math.random = () => 0.5;
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', enableTextStacking: true, textStackingDelay: 5, enableDynamicOnlinePresence: true, enableNotifications: false }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([
      { id: 'maya', name: 'Maya', avatar: '/favicon.svg', status: 'offline', messages: [], voiceSettings: { frequency: 'off' } },
      { id: 'group', name: 'Duo', avatar: '/favicon.svg', status: 'offline', isGroup: true, memberIds: ['maya'], messages: [] },
    ]));
  });
  const screen = await context.newPage();
  const errors = []; screen.on('pageerror', error => errors.push(error.message));
  try {
    await screen.goto(origin);
    for (const [name, id] of [['Maya', 'maya'], ['Duo', 'group']]) {
      await screen.getByRole('button', { name: `Open chat with ${name}`, exact: true }).click();
      const input = screen.getByRole('textbox', { name: 'Message', exact: true });
      await input.fill('First stacked message'); await input.press('Enter');
      const before = requests;
      await screen.waitForTimeout(1200);
      if (requests !== before) throw new Error('Offline message bypassed the configured stack');
      await screen.waitForFunction(id => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === id)?.status === 'online', id, { timeout: 15000 });
      // Online also appears before typing; wait for the completed reply and its lingering presence.
      await screen.getByText(`Synthetic reply ${before + 1}.`, { exact: true }).last().waitFor();
      await screen.waitForFunction(id => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === id)?.status === 'online', id);
      await screen.waitForTimeout(1000);
      if (await screen.evaluate(id => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === id)?.status !== 'online', id)) throw new Error('Persona did not linger online after replying');
      await input.fill('Quick follow-up'); await input.press('Enter');
      await screen.waitForTimeout(1000);
      if (requests !== before + 2) throw new Error(`${name}: online follow-up still waited for stacking (${requests - before} requests)`);
      await screen.getByText(`Synthetic reply ${before + 2}.`, { exact: true }).last().waitFor();
      await screen.waitForFunction(id => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === id)?.status === 'online', id);
      await screen.waitForFunction(id => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === id)?.status === 'offline', id, { timeout: 6500 });
      await screen.getByRole('button', { name: 'Back to chats', exact: true }).click();
    }
    if (errors.length) throw new Error(errors.join('\n'));
    return 'Single/group: offline stacking retained; replies linger online; online follow-ups bypass stacking; idle presence expires.';
  } finally { await context.close(); }
}
