// An in-flight request must stop at the persisted deadline and never restart after fallback.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  let requests = 0; let stage = 'seed';
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', () => { requests++; });
  try {
    await page.goto(origin);
    await page.evaluate(async () => {
      const message = { id: 'deadline-user', text: 'Can you hear me?', sender: 'me', status: 'pending', timestamp: '10:00', date: '2026-10-19' };
      localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', enableTextStacking: false }));
      localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'deadline', name: 'Maya', avatar: '/favicon.svg', messages: [message], voiceSettings: { frequency: 'off' } }]));
      await new Promise((resolve, reject) => { const request = indexedDB.open('whatsapp_offline_db', 1); request.onupgradeneeded = () => { request.result.createObjectStore('pending_outbox', { keyPath: 'id' }); request.result.createObjectStore('synced_background', { keyPath: 'id' }); }; request.onsuccess = () => { const db = request.result; const tx = db.transaction('pending_outbox', 'readwrite'); tx.objectStore('pending_outbox').put({ id: message.id, chatId: 'deadline', message, queuedAt: Date.now() - 55000, retryStartedAt: Date.now() - 55000, attempts: 1 }); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); }; });
    });
    const fixture = await page.evaluate(() => ({ settings: localStorage.getItem('whatsapp_settings'), chats: localStorage.getItem('whatsapp_chats') }));
    await context.addInitScript(fixture => { localStorage.setItem('whatsapp_settings', fixture.settings); localStorage.setItem('whatsapp_chats', fixture.chats); }, fixture);
    await page.reload();
    stage = 'fallback';
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages.some(message => message.id === 'delivery-fallback-deadline-user'));
    stage = 'queue acknowledgement';
    await page.waitForFunction(() => new Promise(resolve => { const request = indexedDB.open('whatsapp_offline_db', 1); request.onsuccess = () => { const db = request.result; const read = db.transaction('pending_outbox').objectStore('pending_outbox').getAll(); read.onsuccess = () => { db.close(); resolve(read.result.length === 0); }; }; }));
    const count = requests;
    if (count !== 1) throw new Error(`Expected one active attempt, got ${count}`);
    await page.clock.install(); await page.clock.runFor(70000);
    await page.evaluate(() => window.dispatchEvent(new Event('online')));
    const messages = await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats'))[0].messages);
    if (requests !== count || messages.filter(message => message.id === 'delivery-fallback-deadline-user').length !== 1) throw new Error('Fallback was duplicated or retried');
    return 'Persisted one-minute deadline aborts an active request, saves one fallback, clears the queue and suppresses later retries.';
  } catch(error) { throw new Error(`${stage}: ${error.message}; requests=${requests}; ${await page.evaluate(()=>localStorage.getItem('whatsapp_chats'))}`); } finally { await context.close(); }
}
