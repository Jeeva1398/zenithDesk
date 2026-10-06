const { test, expect } = require('@playwright/test');
const { createOrg, uniqueClientIp } = require('../helpers');

// The portal draws only the products an org has, and the switcher in the
// header leads to the one it does not.

test.use({
  extraHTTPHeaders: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
});

async function logIn(page, org) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(org.adminEmail);
  await page.getByRole('textbox', { name: 'Password' }).fill(org.password);
  await page.getByRole('button', { name: 'Log in' }).click();
}

test.describe('products in the portal', () => {
  test('a chat-only org opens on its chatbot numbers and sees no ticket pages', async ({ page, request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    await logIn(page, org);

    await expect(page).toHaveURL(/\/dashboard\?view=chatbot$/);
    await expect(page.getByRole('tab', { name: 'Tickets' })).toHaveCount(0);

    const nav = page.locator('aside');
    await expect(nav.getByRole('link', { name: 'Tickets' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Contacts' })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Enquiries' })).toBeVisible();

    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: 'Chat widget' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'SLA' })).toHaveCount(0);
    await expect(page.getByRole('tab', { name: 'Macros' })).toHaveCount(0);

    // A ticket link leads to Desk's page rather than to a broken queue.
    await page.goto('/tickets');
    await expect(page).toHaveURL(/\/products\/desk$/);
    await expect(page.getByRole('heading', { name: 'ZenithDesk Desk' })).toBeVisible();
  });

  test('an admin turns Desk on from the switcher and lands in the ticket queue', async ({ page, request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    await logIn(page, org);
    await expect(page).toHaveURL(/\/dashboard\?view=chatbot$/);

    await page.getByRole('navigation', { name: 'Products' }).getByRole('link', { name: 'Desk' }).click();
    await expect(page).toHaveURL(/\/products\/desk$/);
    await page.getByRole('button', { name: 'Turn on Desk' }).click();

    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
    await expect(page.locator('aside').getByRole('link', { name: 'Customers' })).toBeVisible();
  });

  test('a desk-only org sees no chat pages, and Chat waits in the switcher', async ({ page, request }) => {
    const org = await createOrg(request, { products: ['desk'] });
    await logIn(page, org);

    await expect(page).toHaveURL(/\/tickets$/);
    const nav = page.locator('aside');
    await expect(nav.getByRole('link', { name: 'Enquiries' })).toHaveCount(0);

    await page.goto('/settings');
    await expect(page.getByRole('tab', { name: 'SLA' })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Chat widget' })).toHaveCount(0);

    await page.getByRole('navigation', { name: 'Products' }).getByRole('link', { name: 'Chat' }).click();
    await expect(page).toHaveURL(/\/products\/chat$/);
    await expect(page.getByRole('button', { name: 'Turn on Chat' })).toBeVisible();
  });
});
