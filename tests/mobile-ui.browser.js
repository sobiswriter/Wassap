// Run with an isolated playwright-cli session against a local build; see README.
async (page) => {
  const context = await page.context().browser().newContext({ serviceWorkers: 'block' });
  await context.addInitScript(() => {
    if (!localStorage.getItem('whatsapp_settings')) localStorage.setItem('whatsapp_settings', JSON.stringify({ apiKey: 'ui-test-placeholder-key', aiProvider: 'vertex', theme: 'light', shareUserInfo: true }));
  });
  page = await context.newPage();
  page.setDefaultTimeout(5000);
  const check = (value, message) => { if (!value) throw new Error(message); };
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('http://127.0.0.1:3013');
  await page.setViewportSize({ width: 320, height: 740 });
  await page.getByRole('button', { name: 'Groups', exact: true }).waitFor();
  await page.evaluate(async () => {
    const settings = JSON.parse(localStorage.getItem('whatsapp_settings'));
    localStorage.setItem('whatsapp_settings', JSON.stringify({ ...settings, apiKey: 'ui-test-placeholder-key', aiProvider: 'vertex', isVertexUnlocked: false }));
    localStorage.setItem('wassap_custom_voices', JSON.stringify([{ id: 'ui-test-voice', name: 'Preserved voice', type: 'designed', gender: 'female' }]));
    const put = (name, version, stores, storeName, record) => new Promise((resolve, reject) => {
      const request = indexedDB.open(name, version);
      request.onupgradeneeded = () => stores.forEach(store => { if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' }); });
      request.onerror = () => reject(request.error);
      request.onsuccess = () => { const db = request.result; const tx = db.transaction(storeName, 'readwrite'); tx.objectStore(storeName).put(record); tx.oncomplete = () => { db.close(); resolve(); }; tx.onerror = () => reject(tx.error); };
    });
    await put('whatsapp_media_db', 2, ['media_store'], 'media_store', { id: 'ui-test-media', data: 'data:image/png;base64,c2FtcGxl' });
    await put('whatsapp_offline_db', 1, ['pending_outbox', 'synced_background'], 'pending_outbox', { id: 'ui-test-pending', chatId: '1', queuedAt: Date.now(), message: { id: 'ui-test-pending', sender: 'me', text: 'Preserve pending send', timestamp: '12:00', status: 'sent' } });
  });
  await page.reload();
  await page.getByRole('button', { name: 'Groups', exact: true }).waitFor();
  // First-launch family creation has its own existing default-voice normalization.
  await page.reload();
  await page.getByRole('button', { name: 'Groups', exact: true }).waitFor();
  const preserved = await page.evaluate(() => ({ user: localStorage.getItem('whatsapp_user'), voices: localStorage.getItem('wassap_custom_voices') }));
  check(await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_settings')).apiKey === 'ui-test-placeholder-key'), 'Seed API key missing before navigation');
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats')).map(chat => ({ id: chat.id, messages: chat.messages.map(message => ({ id: message.id, text: message.text, image: message.image, attachment: message.attachment })), memoryBubbles: chat.memoryBubbles, voiceSettings: chat.voiceSettings })));
  for (const width of [320, 360, 390, 412, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const box = await page.getByRole('button', { name: 'Groups', exact: true }).boundingBox();
    check(box && box.x + box.width <= width + 1, `Groups clipped at ${width}`);
    check(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), `Document overflow at ${width}`);
    await page.screenshot({ animations: 'disabled', path: `output/playwright/polished-inbox-${width}.png` });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Groups', exact: true }).click();
  check(await page.getByRole('button', { name: /^Open chat with / }).count() === 1, 'Groups filter does not filter');
  await page.getByRole('button', { name: 'All', exact: true }).click();
  await page.getByRole('textbox', { name: 'Search chats' }).fill('no-match-fixture');
  check(await page.getByRole('status').innerText() === 'No chats found. Try another name.', 'Search empty state missing');
  await page.getByRole('textbox', { name: 'Search chats' }).fill('');
  await page.getByRole('button', { name: 'New chat', exact: true }).click();
  await page.getByRole('dialog', { name: 'New persona' }).waitFor();
  await page.keyboard.press('Escape');
  await page.getByRole('dialog').waitFor({ state: 'hidden' });
  await page.waitForFunction(() => !history.state?.panelOpen);
  await page.getByRole('button', { name: 'Settings', exact: true }).click();
  const settings = page.getByRole('dialog', { name: 'Settings', exact: true });
  await settings.waitFor();
  check(await page.getByRole('switch').count() >= 7, 'Settings switches missing semantics');
  check(await page.evaluate(() => document.activeElement?.getAttribute('data-panel-close') !== null), 'Panel focus not moved to close');
  await page.keyboard.press('Shift+Tab');
  check(await settings.evaluate(element => element.contains(document.activeElement)), 'Focus escaped settings');
  await page.getByRole('switch', { name: 'Dark theme' }).click();
  await page.getByRole('button', { name: 'Close Settings' }).click();
  await page.waitForFunction(() => !history.state?.panelOpen);
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/polished-inbox-dark.png' });
  await page.getByRole('button', { name: 'Open chat with Big Bro', exact: true }).click();
  const attach = page.getByRole('button', { name: 'Attach', exact: true });
  await attach.click();
  const tray = page.getByRole('region', { name: 'Attachments', exact: true });
  await tray.waitFor();
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/polished-attachments-dark.png' });
  check(await attach.getAttribute('aria-expanded') === 'true', 'Attach state missing');
  await page.getByRole('button', { name: 'Open emojis' }).click();
  await tray.waitFor({ state: 'hidden' });
  await page.getByRole('region', { name: 'Emoji, GIF and sticker picker' }).waitFor();
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/polished-emoji-dark.png' });
  await page.goBack();
  await page.getByRole('region', { name: 'Emoji, GIF and sticker picker' }).waitFor({ state: 'hidden' });
  check(await page.getByRole('textbox', { name: 'Message', exact: true }).isVisible(), 'Back left chat instead of closing emoji');
  await attach.click();
  await page.keyboard.press('Escape');
  await tray.waitFor({ state: 'hidden' });
  await page.context().clearPermissions();
  await attach.click();
  await tray.getByRole('button', { name: 'Location', exact: true }).click();
  await page.getByRole('status').filter({ hasText: 'Location unavailable' }).waitFor();
  await page.getByRole('button', { name: 'Dismiss attachment error' }).click();
  for (const height of [500, 844]) {
    await page.setViewportSize({ width: 320, height });
    await attach.click();
    const r = await tray.boundingBox();
    check(r && r.y >= 0 && r.y + r.height < height, `Tray outside short viewport ${height}`);
    await page.getByRole('button', { name: 'Close attachments' }).click();
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await attach.click();
  check(await tray.evaluate(element => parseFloat(getComputedStyle(element).animationDuration) < .001), 'Reduced motion ignored');
  await page.getByRole('button', { name: 'Close attachments' }).click();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/polished-chat-dark.png' });
  await page.getByRole('heading', { name: 'Big Bro', exact: true, level: 2 }).click();
  const profile = page.getByRole('dialog', { name: 'Contact info', exact: true });
  await profile.waitFor();
  await profile.getByRole('heading', { name: 'Voice Settings', exact: true }).click();
  await page.screenshot({ animations: 'disabled', path: 'output/playwright/polished-profile-voice.png' });
  await page.goBack();
  await profile.waitFor({ state: 'hidden' });
  await page.getByRole('button', { name: 'Back to chats' }).click();
  await page.getByRole('button', { name: 'New chat', exact: true }).waitFor();
  for (const [button, name] of [['Guide', 'Guide'], ['App updates', 'App updates']]) {
    await page.getByRole('button', { name: button, exact: true }).click();
    const panel = page.getByRole('dialog', { name, exact: true });
    await panel.waitFor();
    await panel.locator('[data-panel-close]').click();
    await panel.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !history.state?.panelOpen);
  }
  for (const [button, name] of [['New group', 'New group'], ['Your profile', 'Your profile'], ['Calendar notes', 'Calendar notes']]) {
    await page.getByRole('button', { name: 'More options', exact: true }).click();
    await page.getByRole('button', { name: button, exact: true }).click();
    const panel = page.getByRole('dialog', { name, exact: true });
    await panel.waitFor();
    await page.keyboard.press('Escape');
    await panel.waitFor({ state: 'hidden' });
    await page.waitForFunction(() => !history.state?.panelOpen);
  }
  await page.reload();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('whatsapp_chats')).map(chat => ({ id: chat.id, messages: chat.messages.map(message => ({ id: message.id, text: message.text, image: message.image, attachment: message.attachment })), memoryBubbles: chat.memoryBubbles, voiceSettings: chat.voiceSettings })));
  check(JSON.stringify(before) === JSON.stringify(after), 'Existing conversations or persona data changed during navigation');
  const storageIntact = await page.evaluate(async expected => {
    const get = (name, store, id) => new Promise((resolve, reject) => { const request = indexedDB.open(name); request.onerror = () => reject(request.error); request.onsuccess = () => { const db = request.result; const record = db.transaction(store).objectStore(store).get(id); record.onsuccess = () => { db.close(); resolve(record.result); }; record.onerror = () => reject(record.error); }; });
    const media = await get('whatsapp_media_db', 'media_store', 'ui-test-media');
    const pending = await get('whatsapp_offline_db', 'pending_outbox', 'ui-test-pending');
    return {user: localStorage.getItem('whatsapp_user') === expected.user, voices: localStorage.getItem('wassap_custom_voices') === expected.voices, key: JSON.parse(localStorage.getItem('whatsapp_settings')).apiKey === 'ui-test-placeholder-key', media: media?.data === 'data:image/png;base64,c2FtcGxl', pending: pending?.message.text === 'Preserve pending send'};
  }, preserved);
  check(Object.values(storageIntact).every(Boolean), 'Storage fixture check: '+JSON.stringify(storageIntact));
  check(errors.length === 0, `Runtime errors: ${errors.join('; ')}`);
  await context.close();
  return { passed: true, widths: [320, 360, 390, 412, 768, 1024, 1440], checks: 'filter/search, creation, focus, switches, light/dark, tray handoff, Back/Escape, denied location, short viewport, reduced motion, data preservation after reload' };
}
