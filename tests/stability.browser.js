// Synthetic chats and failed requests; no private data or paid model calls.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 360, height: 800 } });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  const check = (value, message) => { if (!value) throw new Error(message); };
  let stage = 'initial';
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  let requests = 0; let fail = true;
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', route => { requests++; return fail ? route.abort('internetdisconnected') : route.fulfill({ json: { text: 'The connection recovered. Bring the blue folder.' } }); });
  await context.addInitScript(() => {
    if (localStorage.getItem('fixture-ready')) return;
    localStorage.setItem('fixture-ready', 'yes');
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', enableTextStacking: false }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'weak', name: 'Maya', avatar: '/favicon.svg', status: 'offline', lastSeen: '10:24', messages: Array.from({ length: 1000 }, (_, i) => ({ id: `old-${i}`, sender: 'other', text: `Earlier message ${i}`, timestamp: '10:24', date: '2026-10-19' })), voiceSettings: { frequency: 'off' } }]));
  });
  const pending = () => page.evaluate(() => new Promise((resolve, reject) => { const req = indexedDB.open('whatsapp_offline_db', 1); req.onsuccess = () => { const db = req.result; const query = db.transaction('pending_outbox').objectStore('pending_outbox').getAll(); query.onsuccess = () => { db.close(); resolve(query.result); }; query.onerror = () => reject(query.error); }; }));
  try {
    await page.goto(origin);
    await page.getByRole('button', { name: /^Open chat with Maya/ }).click();
    check(await page.getByText(/^Earlier message /).count() === 80, 'Long chat mounted its entire history');
    await page.getByRole('button', { name: 'Load earlier messages' }).click();
    check(await page.getByText(/^Earlier message /).count() === 160, 'Older messages could not be loaded');
    const presence = page.locator('.chat-presence');
    for (const width of [320, 360, 412]) {
      await page.setViewportSize({ width, height: 800 });
      check(await presence.evaluate(el => el.scrollWidth <= el.clientWidth + 1 && getComputedStyle(el).textOverflow !== 'ellipsis' && el.getBoundingClientRect().bottom <= el.closest('.app-header').getBoundingClientRect().bottom), `Last seen remains clipped at ${width}`);
    }
    await page.setViewportSize({ width: 360, height: 800 });
    const colors = await page.evaluate(() => ['--chat-bg', '--panel-bg', '--header-bg', '--bubble-other'].map(name => getComputedStyle(document.documentElement).getPropertyValue(name).trim()));
    check(colors.every(color => color === '#0b1014'), `Dark surfaces mismatch: ${colors}`);
    const input = page.getByRole('textbox', { name: /message/i }).last();
    await input.fill('Please keep this request if the network drops.'); await input.press('Enter');
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.some(m => m.text === 'Please keep this request if the network drops.' && m.status === 'pending'));
    check(requests >= 1, 'Test did not exercise a failed network request');
    check((await pending()).length === 1, 'Failed request was discarded');
    stage = 'reload';
    await page.reload();
    stage = 'reconnect';
    fail = false;
    await page.clock.install();
    await page.clock.runFor(16000);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.some(m => m.text === 'The connection recovered. Bring the blue folder.'));
    await page.waitForFunction(() => new Promise(resolve => { const req = indexedDB.open('whatsapp_offline_db', 1); req.onsuccess = () => { const db = req.result; const query = db.transaction('pending_outbox').objectStore('pending_outbox').getAll(); query.onsuccess = () => { db.close(); resolve(query.result.length === 0); }; }; }));
    const messages = await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages);
    check(messages.filter(m => m.text === 'Please keep this request if the network drops.').length === 1, 'Reconnect duplicated the user message');
    check(messages.filter(m => m.text === 'The connection recovered. Bring the blue folder.').length === 1, 'Reconnect duplicated the answer');
    check(messages.length === 1002, 'Existing history changed');
    const beforeReplay = requests;
    await page.evaluate(() => new Promise((resolve, reject) => {
      const message = JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.find(m => m.text === 'Please keep this request if the network drops.');
      const request = indexedDB.open('whatsapp_offline_db', 1);
      request.onsuccess = () => { const db = request.result; const tx = db.transaction('pending_outbox', 'readwrite'); tx.objectStore('pending_outbox').put({ id: message.id, chatId: 'weak', message, queuedAt: Date.now() }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    }));
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    await page.waitForFunction(() => new Promise(resolve => { const req = indexedDB.open('whatsapp_offline_db', 1); req.onsuccess = () => { const db = req.result; const query = db.transaction('pending_outbox').objectStore('pending_outbox').getAll(); query.onsuccess = () => { db.close(); resolve(query.result.length === 0); }; }; }));
    check(requests === beforeReplay, 'Already saved reply was generated again after interrupted acknowledgement');
    stage = 'open after recovery';
    await page.goto(origin);
    await page.getByRole('button', { name: /^Open chat with Maya/ }).click();
    await page.getByRole('button', { name: 'Back to chats' }).waitFor();
    for (let i = 0; i < 8; i++) {
      stage = `back ${i}`;
      await page.getByRole('button', { name: 'Back to chats' }).click();
      stage = `open ${i}`;
      await page.getByRole('button', { name: /^Open chat with Maya/ }).click();
      await page.getByRole('button', { name: 'Back to chats' }).waitFor();
    }
    check(errors.length === 0, errors.join('\n'));
    await page.screenshot({ path: 'output/playwright/stability-dark-360.png', animations: 'disabled' });
    return 'Failed requests survive reload; reconnect retries once without losing history; 1000-message chat renders 80/160 rows; last seen wraps; dark base matches; repeated navigation stays visible.';
  } catch(error) { await page.screenshot({path:'output/playwright/stability-failure.png'}); throw new Error(`${stage}: ${error.message}; ${await page.evaluate(()=>JSON.stringify({state:history.state, screens:[...document.querySelectorAll('.mobile-screen')].map(el=>({class:el.className, inert:el.inert, visibility:getComputedStyle(el).visibility}))}))}`); } finally { await context.close(); }
}
