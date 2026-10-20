// Isolated browser fixtures: no real model calls or OS notification delivery.
async (page) => {
  const origin = new URL(page.url()).origin;
  const browser = page.context().browser();
  const boot = await browser.newContext({ serviceWorkers: 'block', viewport: { width: 390, height: 844 } });
  try {
    await boot.route('**/assets/*.js', route => route.abort());
    const screen = await boot.newPage(); await screen.goto(origin);
    await screen.getByRole('heading', { name: 'Wassap', exact: true }).waitFor();
    if (await screen.locator('.app-boot').evaluate(el => getComputedStyle(el).backgroundColor !== 'rgb(11, 16, 20)')) throw new Error('App stylesheet overrides boot background');
    for (const width of [320, 390, 1440]) {
      await screen.setViewportSize({ width, height: 844 });
      if (await screen.evaluate(() => document.documentElement.scrollWidth > innerWidth || document.documentElement.scrollHeight > innerHeight)) throw new Error(`Boot overflows at ${width}`);
    }
    await screen.setViewportSize({ width: 390, height: 844 });
    await screen.screenshot({ path: 'output/playwright/loading-mobile.png' });
    await screen.emulateMedia({ reducedMotion: 'reduce' });
    if (await screen.locator('.app-boot-track').evaluate(el => getComputedStyle(el, '::after').animationName !== 'none')) throw new Error('Reduced motion ignored');
    if (await screen.getByRole('link', { name: 'Taking a while? Reload' }).getAttribute('href') !== '/') throw new Error('Boot recovery link missing');
  } finally { await boot.close(); }

  const context = await browser.newContext({ serviceWorkers: 'block', permissions: ['notifications'], viewport: { width: 390, height: 844 } });
  let requests = 0;
  const replies = ['Bada jaldi yaad aa gaya tera... abhi classes khatam karke hostel ja rahi hoon,\n\ntu kahan mara pada tha?', 'Bring the pictures tomorrow.\n\nAnd the blue bag too.'];
  await context.route('**/api/gemini/auth', route => route.fulfill({ json: { ok: true } }));
  await context.route('**/api/gemini/generate', route => route.fulfill({ json: { text: replies[requests++] } }));
  await context.addInitScript(() => {
    localStorage.setItem('whatsapp_settings', JSON.stringify({ aiProvider: 'vertex', theme: 'dark', enableTextStacking: false, enableNotifications: true }));
    localStorage.setItem('whatsapp_chats', JSON.stringify([{ id: 'notify', name: 'Maya', avatar: '/favicon.svg', status: 'offline', messages: [], voiceSettings: { frequency: 'off' } }]));
    window.__notifications = [];
    Object.defineProperty(navigator.serviceWorker, 'ready', { value: Promise.resolve({ showNotification: async (title, options) => window.__notifications.push({ title, ...options }) }) });
  });
  try {
    const screen = await context.newPage(); screen.setDefaultTimeout(20000);
    await screen.goto(origin); await screen.getByRole('button', { name: /^Open chat with Maya/ }).click();
    if (await screen.locator('.app-boot').count()) throw new Error('Boot did not leave after app mounted');
    await screen.evaluate(() => Object.defineProperty(document, 'hidden', { get: () => true }));
    for (let turn = 0; turn < 2; turn++) {
      const input = screen.getByRole('textbox', { name: 'Message', exact: true });
      await input.fill(turn ? 'What should I bring?' : 'Where are you?'); await input.press('Enter');
      const expected = replies[turn].replace(/\n\n/g, '\n');
      await screen.waitForFunction(expected => window.__notifications.some(item => item.body === expected), expected);
      const notification = await screen.evaluate(() => window.__notifications.at(-1));
      if (notification.body !== expected || notification.tag !== 'notify' || !notification.icon.startsWith('data:image/png') || !notification.actions.some(action => action.action === 'reply')) throw new Error('Full turn, persona photo or reply action lost');
      if (turn && notification.body.includes('hostel')) throw new Error('Previous response leaked into new notification');
    }
    if (requests !== 2) throw new Error('Unexpected model request');
    return 'Boot fits 320/390/1440px, respects reduced motion and exits on mount. Both persona fragments reach notification, retain portrait/Reply, and next turn replaces previous response.';
  } finally { await context.close(); }
}
