const { test, expect } = require('@playwright/test');
const { BETA, TARGET } = require('../test-env');

// The Chat landing page, served by nginx at the root of the chat server's own
// host - which must keep answering the widget's API everywhere else. Its live
// demo is the real widget, and the widget's "Powered by" badge leads back here.

test.skip(TARGET !== 'beta', 'runs against the beta servers only');

test.describe('Chat landing on beta', () => {
  test('is served at the chat host, with the API still behind it', async ({ page, request }) => {
    await page.goto(`${BETA.chat}/`);
    await expect(page).toHaveTitle(/ZenithDesk Chat/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText('Answers from your website.');

    const health = await request.get(`${BETA.chat}/health`);
    expect(health.status()).toBe(200);
    expect(await health.json()).toEqual({ status: 'ok' });
    const widget = await request.get(`${BETA.chat}/widget.js`);
    expect(widget.status()).toBe(200);
  });

  test('signs people up for Chat alone, and links to Desk', async ({ page }) => {
    await page.goto(`${BETA.chat}/`);
    const start = page.getByRole('link', { name: /^Start free/ }).first();
    await expect(start).toHaveAttribute('href', `${BETA.portal}/register?product=chat`);
    await expect(page.getByRole('link', { name: 'ZenithDesk Desk' }).first()).toHaveAttribute('href', /zenithdesk\.site/);

    await start.click();
    await expect(page).toHaveURL(`${BETA.portal}/register?product=chat`);
    await expect(page.getByRole('heading', { name: 'Start with ZenithDesk Chat' })).toBeVisible();
  });

  test('its live demo is the real widget, answering from articles', async ({ page }) => {
    await page.goto(`${BETA.chat}/?ref=widget`);
    // The widget mounts itself once its script has loaded.
    await expect(page.getByRole('button', { name: /^Open chat/ })).toBeVisible({ timeout: 30_000 });
    await page.getByRole('button', { name: 'Try the live demo' }).click();

    const box = page.getByRole('textbox', { name: 'Ask a question' });
    await expect(box).toBeVisible({ timeout: 30_000 });
    await box.fill('How do I add the widget to my website?');
    await box.press('Enter');
    await expect(page.locator('.zd-message__sources').last()).toContainText('Adding the widget to your website', {
      timeout: 90_000,
    });

    // The badge leads back to this page, marked as coming from a widget.
    await expect(page.locator('.zd-powered')).toHaveAttribute('href', 'https://chat.zenithdesk.site/?ref=widget');
  });
});
