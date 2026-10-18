async (page) => {
  const context = await page.context().browser().newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
  page = await context.newPage();
  page.setDefaultTimeout(10000);
  const check = (condition, message) => { if (!condition) throw new Error(message); };
  try {
    await page.goto('http://127.0.0.1:3013');
    await page.getByRole('button', { name: 'Open chat with Mom', exact: true }).click();
    await page.getByRole('heading', { name: 'Mom', exact: true, level: 2 }).click();
    const profile = page.locator('[data-app-panel="Contact info"]');
    const toggle = profile.getByRole('switch', { name: 'Time awareness', exact: true });
    check(await toggle.getAttribute('aria-checked') === 'true', 'Legacy persona did not default on');
    await toggle.click();
    await page.waitForFunction(() => document.querySelector('[role="switch"][aria-label="Time awareness"]')?.getAttribute('aria-checked') === 'false');
    await page.screenshot({ animations: 'disabled', path: 'output/playwright/time-awareness-off.png' });
    await profile.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await page.waitForFunction(() => JSON.parse(localStorage.getItem('whatsapp_chats')).find(chat => chat.name === 'Mom').timeAwarenessEnabled === false);
    await page.reload();
    await page.getByRole('button', { name: 'Open chat with Mom', exact: true }).click();
    await page.getByRole('heading', { name: 'Mom', exact: true, level: 2 }).click();
    check(await toggle.getAttribute('aria-checked') === 'false', 'Persona toggle did not survive reload');
    await profile.getByRole('button', { name: 'Close', exact: true }).click();
    await page.getByRole('button', { name: 'Back to chats', exact: true }).click();
    await page.getByRole('button', { name: 'Open chat with Sis', exact: true }).click();
    await page.getByRole('heading', { name: 'Sis', exact: true, level: 2 }).click();
    check(await toggle.getAttribute('aria-checked') === 'true', 'Disabling one persona changed another');
    return 'Persona time-awareness defaults on, saves off across reload and remains independent per persona.';
  } finally { await context.close(); }
}
