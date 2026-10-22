async (page) => {
  const origin = new URL(page.url()).origin;
  const results = [];
  for (const kind of ['group', 'photo']) {
    const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const screen = await context.newPage(); screen.setDefaultTimeout(20000);
    let fail = true; let excuses = 0;
    await context.route('**/api/gemini/**', route => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/auth')) return route.fulfill({ json: { ok: true } });
      if (path.endsWith('/image-excuse')) { excuses++; return route.fulfill({ json: { text: 'This excuse must never appear' } }); }
      if (path.endsWith('/image-synthesize')) return route.fulfill({ json: { result: { mode: 'pov', is_persona_subject: false, caption: 'Recovered photo', action_and_setting: 'A garden' } } });
      if (path.endsWith('/image-generate')) return fail ? route.fulfill({ status: 500, json: { blocked: true, error: 'Synthetic unavailable photo' } }) : route.fulfill({ json: { imageData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cF9sAAAAASUVORK5CYII=' } });
      if (path.endsWith('/generate')) return fail ? route.fulfill({ status: 503, json: { error: 'Synthetic unavailable reply' } }) : route.fulfill({ json: { text: 'Recovered group answer.' } });
      return route.fulfill({ json: {} });
    });
    await context.addInitScript(({ kind }) => {
      Math.random = () => 0.5;
      localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', enableTextStacking: false, enableNotifications: false }));
      const persona = { id: 'member', name: 'Maya', avatar: '/favicon.svg', messages: [], voiceSettings: { frequency: 'off' } };
      const chat = kind === 'group' ? { id: 'target', name: 'Trip', avatar: '/favicon.svg', isGroup: true, memberIds: ['member'], messages: [] } : { ...persona, id: 'target' };
      localStorage.setItem('whatsapp_chats', JSON.stringify([chat, ...(kind === 'group' ? [persona] : [])]));
    }, { kind });
    try {
      await screen.goto(origin);
      await screen.getByRole('button', { name: new RegExp(`^Open chat with ${kind === 'group' ? 'Trip' : 'Maya'}`) }).click();
      const input = screen.getByRole('textbox', { name: 'Message', exact: true });
      await input.fill(kind === 'photo' ? '@img Show me the garden' : 'Where shall we meet?'); await input.press('Enter');
      await screen.getByRole('button', { name: 'Message not sent. Retry', exact: true }).waitFor();
      const before = await screen.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages);
      if (before.length !== 1 || before[0].status !== 'failed' || excuses) throw new Error(`${kind}: Failure invented a message or did not become retryable`);
      fail = false;
      await screen.getByRole('button', { name: 'Message not sent. Retry', exact: true }).click();
      await screen.getByText(kind === 'photo' ? 'Recovered photo' : 'Recovered group answer.', { exact: true }).last().waitFor();
      const after = await screen.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages);
      if (after.filter(message => message.sender === 'me').length !== 1 || after[0].id !== before[0].id || after.filter(message => message.sender === 'other').length !== 1 || excuses) throw new Error(`${kind}: Retry duplicated input/output or generated an excuse`);
      results.push(`${kind}: failed original becomes retryable and recovers once, without an excuse.`);
    } finally { await context.close(); }
  }
  return results.join('\n');
}
