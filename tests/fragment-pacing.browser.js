// Observe actual delivery spacing and muted busy indicators with synthetic responses.
async (page) => {
  const origin = new URL(page.url()).origin;
  for (const theme of ['light', 'dark']) {
    const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
    await context.route('**/api/gemini/generate', route => route.fulfill({ json: { text: 'Fragment one.\n\nHere is the second part.\n\nAnd the final part.' } }));
    await context.route('**/api/gemini/tts', () => {});
    await context.addInitScript(theme => {
      Math.random = () => 0.5;
      localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme, enableTextStacking: false }));
      localStorage.setItem('whatsapp_chats', JSON.stringify([
        { id: 'maya', name: 'Maya', avatar: '/favicon.svg', messages: [], voiceSettings: { frequency: 'off' } },
        { id: 'group', name: 'Duo', avatar: '/favicon.svg', isGroup: true, memberIds: ['maya'], messages: [] },
        { id: 'voice', name: 'Voice', avatar: '/favicon.svg', messages: [], voiceSettings: { frequency: 'always', voiceName: 'Aoede' } },
      ]));
    }, theme);
    const screen = await context.newPage();
    try {
      screen.setDefaultTimeout(15000); await screen.goto(origin);
      const gray = await screen.evaluate(() => { const el = document.createElement('span'); el.className = 'text-secondary'; document.body.append(el); const color = getComputedStyle(el).color; el.remove(); return color; });
      for (const [name, id] of [['Maya', 'maya'], ['Duo', 'group']]) {
        await screen.getByRole('button', { name: `Open chat with ${name}`, exact: true }).click();
        const input = screen.getByRole('textbox', { name: 'Message', exact: true });
        await input.fill('Send the three parts.'); await input.press('Enter');
        await screen.getByText('Fragment one. Here is the second part.', { exact: true }).last().waitFor();
        await screen.waitForFunction(() => document.querySelector('.chat-presence')?.textContent?.trim() === 'typing...');
        if (await screen.locator('span').filter({ hasText: /^And the final part\.$/ }).count()) throw new Error('Next fragment arrived before visible typing');
        for (const label of await screen.getByText('typing...', { exact: true }).all()) {
          if (await label.evaluate(el => getComputedStyle(el).color) !== gray) throw new Error(`${theme}: typing indicator is not gray`);
        }
        await screen.locator('span').filter({ hasText: /^And the final part\.$/ }).waitFor();
        const times = await screen.evaluate(id => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.id === id).messages.filter(message => message.sender === 'other').map(message => message.timestampEpoch), id);
        if (times.length !== 2) throw new Error('Fragment count changed');
        for (let i = 1; i < times.length; i++) if (times[i] - times[i - 1] < 1500 || times[i] - times[i - 1] > 2600) throw new Error(`${name}: unnatural fragment gap ${times[i] - times[i - 1]} ms`);
        await screen.getByRole('button', { name: 'Back to chats', exact: true }).click();
      }
      await screen.getByRole('button', { name: 'Open chat with Voice', exact: true }).click();
      const input = screen.getByRole('textbox', { name: 'Message', exact: true }); await input.fill('Send a voice note.'); await input.press('Enter');
      await screen.waitForFunction(() => document.querySelector('.chat-presence')?.textContent?.includes('recording audio'));
      for (const label of await screen.getByText('recording audio...', { exact: true }).all()) {
        if (await label.evaluate(el => getComputedStyle(el).color) !== gray) throw new Error(`${theme}: recording indicator is not gray`);
      }
      await screen.screenshot({ path: `output/playwright/recording-gray-${theme}.png` });
    } catch (error) { throw new Error(`${error.message}\n${await screen.locator('body').innerText()}`); }
    finally { await context.close(); }
  }
  return 'Single/group fragments arrive after visible typing with 1.5–2.5 second pacing (100 ms scheduling tolerance); typing/recording text is muted gray in both themes.';
}

