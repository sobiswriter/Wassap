// Newly installed worker must cache unvisited lazy panels, not just index.html.
async (page) => {
  const origin = new URL(page.url()).origin;
  const context = await page.context().browser().newContext({ serviceWorkers: 'allow', viewport: { width: 390, height: 844 } });
  page = await context.newPage(); page.setDefaultTimeout(15000);
  const failed = []; page.on('requestfailed', request => failed.push(request.url() + ': ' + request.failure()?.errorText));
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(origin); await page.evaluate(() => navigator.serviceWorker.ready);
    await page.reload(); await page.waitForFunction(() => navigator.serviceWorker.controller);
    const cache = await page.evaluate(async () => { const cache = await caches.open('wassap-shell-v24'); return (await cache.keys()).map(request => request.url); });
    if (!cache.some(url => /SettingsPopover-.*\.js/.test(url)) || !cache.some(url => /vendor-genai-.*\.js/.test(url))) throw new Error('Worker omitted unvisited app chunks');
    await context.setOffline(true);
    const probe = await page.evaluate(async url => { const response = await fetch(url); return [response.status, response.headers.get('Content-Type'), (await response.text()).slice(0,80)]; }, cache.find(url => /SettingsPopover-.*\.js/.test(url)));
    if (probe[0] !== 200) throw new Error(`Cached panel failed: ${probe}`);
    await page.getByRole('button', { name: 'Settings', exact: true }).click();
    await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('dialog', { name: 'Settings', exact: true }).waitFor({ state: 'hidden' });
    await page.reload(); await page.getByRole('button', { name: 'Reload app', exact: true }).waitFor();
    if (errors.length) throw new Error(errors.join('\n'));
    return 'Fresh install caches entry/vendor/CSS/lazy chunks; unvisited Settings opens offline; cold offline reload stays usable.';
  } catch (error) { await page.screenshot({path:'output/playwright/offline-failure.png'}); throw new Error(`${error.message}; errors=${errors.join(';')}; failed=${failed.join(';')}; text=${(await page.locator('body').textContent()).slice(0,1600)}`); } finally { await context.close(); }
}
