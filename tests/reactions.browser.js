// Isolated UI/context checks with mocked generation; no paid model requests.
async (page) => {
  const browser = page.context().browser();
  const check = (value, message) => { if (!value) throw new Error(message); };
  for (const theme of ['light', 'dark']) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const requests = []; const errors = [];
    await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true, unlocked: true } }));
    await context.route('**/api/gemini/generate', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { text: 'Fixture reply' } }); });
    await context.addInitScript(({ theme }) => {
      localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'reaction-test', name: 'Maya', avatar: '/favicon.svg', status: 'online', about: 'A thoughtful friend', messages: [{ id: 'original', sender: 'other', text: 'Bring the bag tomorrow', timestamp: '10:00', date: '2026-10-19' }], voiceSettings: { frequency: 'off' } }]));
      localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme, enableTextStacking: true, textStackingDelay: 3 }));
    }, { theme });
    const p = await context.newPage(); p.setDefaultTimeout(7000); p.on('pageerror', error => errors.push(error.message));
    let stage = "open";
    try {
      await p.goto('http://127.0.0.1:3013');
      await p.getByRole('button', { name: 'Open chat with Maya', exact: true }).click();
      const openPicker = async () => {
        await p.getByText('Bring the bag tomorrow', { exact: true }).click({ button: 'right' });
        await p.getByRole('button', { name: 'More reactions', exact: true }).click();
        await p.getByRole('dialog', { name: 'All reactions' }).waitFor();
      };
      stage = "picker";
      await openPicker();
      const picker = p.getByRole('dialog', { name: 'All reactions' });
      check(await picker.getByRole('button', { name: /^React / }).count() === 60, 'Expanded reactions missing');
      for (const width of [320, 390, 1440]) {
        await p.getByRole('button', { name: 'Close reactions' }).click();
        await p.setViewportSize({ width, height: 740 });
        await p.getByRole('button', { name: 'More reactions', exact: true }).click();
        const rect = await picker.boundingBox();
        check(rect.x >= 0 && rect.x + rect.width <= width && rect.y >= 0 && rect.y + rect.height <= 740, `Picker clipped at ${width}`);
      }
      await p.setViewportSize({ width: 390, height: 844 });
      await p.waitForFunction(() => { const r = document.querySelector('[aria-label="All reactions"]').getBoundingClientRect(); return r.right <= innerWidth && r.top >= 0; }, null, { timeout: 7000 });
      await picker.getByRole('textbox', { name: 'Custom emoji' }).fill('not an emoji');
      check(await picker.getByRole('button', { name: 'Add', exact: true }).isDisabled(), 'Prose accepted as reaction');
      await picker.getByRole('textbox', { name: 'Custom emoji' }).press('Escape');
      check(await p.getByRole('button', { name: 'More reactions', exact: true }).evaluate(e => e === document.activeElement), 'Escape did not return focus');
      await p.getByRole('button', { name: 'More reactions', exact: true }).click();
      await picker.getByRole('textbox', { name: 'Custom emoji' }).fill('👩🏽‍💻');
      await p.screenshot({ path: `output/playwright/reactions-${theme}.png` });
      stage = 'save custom emoji';
      await picker.getByRole('textbox', { name: 'Custom emoji' }).press('Enter');
      await p.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages[0].reactions?.includes('👩🏽‍💻'));
      for (let i = 0; i < 60 && !requests.length; i++) await new Promise(resolve => setTimeout(resolve, 100));
      check(requests.length === 1 && requests[0].initiationContext.includes('reaction is the new interaction'), 'Reaction-only priority missing');
      stage = 'reply persistence';
      await p.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.some(m => m.text === 'Fixture reply'), null, { timeout: 30000 });
      await openPicker();
      await picker.getByRole('button', { name: 'React 🙄', exact: true }).click();
      await p.getByRole('textbox', { name: 'Message', exact: true }).fill('I will bring the pictures too');
      await p.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
      for (let i = 0; i < 70 && requests.length < 2; i++) await new Promise(resolve => setTimeout(resolve, 100));
      check(requests.length === 2 && requests[1].initiationContext.includes('text, images and audio first'), 'Mixed reaction/message priority missing');
      check(requests[1].messageHistory.some(m => m.text === 'I will bring the pictures too'), 'Main message missing');
      stage = 'message then reaction';
      await p.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.filter(m => m.text === 'Fixture reply').length === 2, null, { timeout: 30000 });
      await p.getByRole('textbox', { name: 'Message', exact: true }).fill('And the blue folder');
      await p.getByRole('textbox', { name: 'Message', exact: true }).press('Enter');
      await openPicker();
      await picker.getByRole('button', { name: 'React 🤔', exact: true }).click();
      for (let i = 0; i < 70 && requests.length < 3; i++) await new Promise(resolve => setTimeout(resolve, 100));
      check(requests.length === 3 && requests[2].initiationContext.includes('text, images and audio first'), 'Message-then-reaction priority missing');
      check(requests[2].messageHistory.some(m => m.text === 'And the blue folder'), 'Stacked message missing');
      check(errors.length === 0, errors.join('\n'));
    } catch (error) { await p.screenshot({ path: 'output/playwright/reaction-error.png' }); throw new Error(`${theme}: ${stage}: ${error.message}`); } finally { await context.close(); }
  }
  return '60 reactions, custom joined emoji validation/persistence, mobile/desktop bounds, light/dark picker and reaction-only versus mixed-message context passed.';
}
