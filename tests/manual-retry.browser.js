// Synthetic messages and intercepted APIs; no real personas, credentials or paid requests.
async (page) => {
  const origin = new URL(page.url()).origin;
  const browser = page.context().browser();
  const check = (value, message) => { if (!value) throw new Error(message); };
  const results = [];
  for (const [provider, stacking] of [['vertex', false], ['vertex', true], ['studio', false]]) {
    const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
    const screen = await context.newPage(); screen.setDefaultTimeout(20000);
    let fail = true; const requests = []; const errors = [];
    screen.on('pageerror', error => errors.push(error.message));
    await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
    await context.route('**/api/gemini/generate', route => {
      requests.push(route.request().postDataJSON());
      return fail ? route.fulfill({ status: 503, json: { error: 'Temporary network failure' } }) : route.fulfill({ json: { text: 'The original request succeeded.' } });
    });
    await context.route('https://generativelanguage.googleapis.com/**', route => {
      requests.push(route.request().postDataJSON());
      return fail ? route.fulfill({ status: 400, json: { error: { message: 'Synthetic request failure', status: 'INVALID_ARGUMENT', code: 400 } } }) : route.fulfill({ json: { candidates: [{ content: { parts: [{ text: 'The original request succeeded.' }] } }] } });
    });
    await context.addInitScript(({ stacking, provider }) => {
      if (localStorage.getItem('manual-retry-fixture')) return;
      localStorage.setItem('manual-retry-fixture', 'yes');
      localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: provider, apiKey: 'synthetic-retry-test', theme: 'dark', enableTextStacking: stacking, textStackingDelay: 1, enableNotifications: false, enableDynamicOnlinePresence: false }));
      localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'retry', name: 'Maya', avatar: '/favicon.svg', messages: [], voiceSettings: { frequency: 'off' } }]));
    }, { stacking, provider });
    try {
      await screen.goto(origin);
      await screen.getByRole('button', { name: /^Open chat with Maya/ }).click();
      const input = screen.getByRole('textbox', { name: 'Message', exact: true });
      await input.fill('First original prompt'); await input.press('Enter');
      if (stacking) { await input.fill('Second in the same stack'); await input.press('Enter'); }
      const failed = screen.getByRole('button', { name: 'Message not sent. Retry', exact: true });
      await failed.first().waitFor();
      const before = await screen.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages);
      const originals = before.filter(message => message.sender === 'me');
      check(originals.length === (stacking ? 2 : 1) && originals.every(message => message.status === 'failed'), 'Failed attempt did not mark exactly its original prompts');
      check(!before.some(message => message.sender === 'other'), 'Failure invented a persona excuse');
      check(new Set(originals.map(message => message.deliveryGroupId)).size === 1, 'Original stack boundary missing');
      const oldRequests = requests.length;
      await screen.reload();
      await screen.getByRole('button', { name: /^Open chat with Maya/ }).click();
      await failed.first().waitFor();
      await screen.evaluate(() => window.dispatchEvent(new Event('online')));
      await screen.waitForTimeout(5500);
      check(requests.length === oldRequests, 'Reload/reconnect automatically resent a manually failed prompt');
      await screen.screenshot({ path: `output/playwright/manual-retry-${stacking ? 'stack' : 'single'}.png`, animations: 'disabled' });
      fail = false;
      await failed.first().dblclick();
      await screen.getByText('The original request succeeded.', { exact: true }).last().waitFor();
      check(requests.length === oldRequests + 1, 'Rapid retry taps duplicated the request');
      await screen.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.filter(message => message.sender === 'me').every(message => message.status !== 'failed' && message.status !== 'pending'));
      const after = await screen.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages);
      check(after.filter(message => message.sender === 'me').map(message => message.id).join() === originals.map(message => message.id).join(), 'Retry duplicated or replaced the original messages');
      check(after.filter(message => message.sender === 'other').length === 1, 'Retry duplicated the answer');
      if (provider === 'vertex') check(requests.at(-1).messageHistory.filter(message => message.sender === 'me').length === originals.length, 'Retry lost part of the stack');
      else check(JSON.stringify(requests.at(-1).contents).includes('First original prompt'), 'Studio retry lost its original prompt');
      check(errors.length === 0, errors.join('\n'));
      results.push(`${provider} ${stacking ? 'stacked' : 'single'}: failure/reload/manual retry/rapid taps preserve original IDs and deliver once.`);
    } finally { await context.close(); }
  }

  // An older failed media stack must not absorb a later failed prompt, even after settings change.
  const context = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 320, height: 740 } });
  const screen = await context.newPage(); screen.setDefaultTimeout(20000);
  const requests = [];
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', route => { requests.push(route.request().postDataJSON()); return route.fulfill({ json: { text: 'The saved photo arrived.' } }); });
  await context.addInitScript(() => {
    if (localStorage.getItem('media-retry-fixture')) return;
    localStorage.setItem('media-retry-fixture', 'yes');
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', enableTextStacking: false }));
    const messages = [
      { id: 'photo', text: 'Original saved photo', sender: 'me', status: 'failed', deliveryGroupId: 'caption', timestamp: '22:28', attachment: { type: 'image', name: 'photo.png', mediaId: 'retry-saved-photo', data: '' }, mediaId: 'retry-saved-photo' },
      { id: 'caption', text: 'Original caption', sender: 'me', status: 'failed', deliveryGroupId: 'caption', timestamp: '22:28' },
      { id: 'later', text: 'Newer unrelated prompt', sender: 'me', status: 'failed', deliveryGroupId: 'later', timestamp: '22:29' }
    ];
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'media', name: 'Maya', avatar: '/favicon.svg', messages, voiceSettings: { frequency: 'off' } }]));
  });
  try {
    await screen.goto(origin);
    await screen.evaluate(() => new Promise((resolve, reject) => {
      const request = indexedDB.open('whatsapp_media_db', 2);
      request.onupgradeneeded = () => request.result.createObjectStore('media_store', { keyPath: 'id' });
      request.onsuccess = () => { const db = request.result; const tx = db.transaction('media_store', 'readwrite'); tx.objectStore('media_store').put({ id: 'retry-saved-photo', data: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+cF9sAAAAASUVORK5CYII=', timestamp: Date.now() }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    }));
    await screen.getByRole('button', { name: /^Open chat with Maya/ }).click();
    await screen.getByRole('button', { name: 'Retry media message', exact: true }).waitFor();
    check(!await screen.evaluate(() => document.documentElement.scrollWidth > innerWidth), 'Retry UI overflows at 320px');
    await screen.screenshot({ path: 'output/playwright/manual-retry-media-320.png', animations: 'disabled' });
    await screen.getByRole('button', { name: 'Retry media message', exact: true }).click();
    await screen.getByText('The saved photo arrived.', { exact: true }).last().waitFor();
    const messages = await screen.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages);
    check(messages.find(message => message.id === 'later').status === 'failed', 'Retry changed a newer failed prompt');
    check(messages.filter(message => message.sender === 'me').length === 3, 'Media retry duplicated input');
    check(requests.length === 1, 'Media retry dispatched more than once');
    check(requests[0].messageHistory.filter(message => message.sender === 'me').length === 2, 'Media retry absorbed a later prompt or lost its caption');
    check(requests[0].messageHistory.some(message => message.image?.startsWith('data:image/png')), 'Retry did not hydrate the original saved attachment');
    results.push('Saved photo/caption retry keeps its original stack after stacking is turned off; newer failures stay untouched; 320px UI fits.');
  } finally { await context.close(); }
  return results.join('\n');
}
