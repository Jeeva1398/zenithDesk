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

    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole('heading', { name: 'Set up your bot' })).toBeVisible();

    await page.goto('/dashboard');
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

  test("a chat-only org's bot settings offer no tickets, and point to Desk", async ({ page, request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    await logIn(page, org);
    await expect(page).toHaveURL(/\/chat$/);

    await page.goto('/settings?tab=chatbot');
    await expect(page.getByRole('checkbox', { name: 'Take enquiries' })).toBeChecked();
    await expect(page.getByRole('checkbox', { name: 'Raise support tickets' })).toBeDisabled();
    await expect(page.getByRole('checkbox', { name: 'Check ticket status' })).toBeDisabled();
    await expect(page.getByText('Needs ZenithDesk Desk')).toHaveCount(2);
    await expect(page.getByRole('button', { name: 'Support only' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Answers only' }).click();
    await expect(page.getByText(/left as messages on the Enquiries page/)).toBeVisible();
    await page.getByRole('button', { name: 'Save' }).click();
    await expect(page.getByText(/^Saved\./)).toBeVisible();
  });

  test('signing up for Chat alone opens on its setup checklist', async ({ page }) => {
    await page.goto('/register?product=chat');
    await expect(page.getByRole('heading', { name: 'Start with ZenithDesk Chat' })).toBeVisible();

    const email = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
    await page.getByLabel('Organization name').fill('Chat Signup Co');
    await page.getByLabel('Your name').fill('Priya Shah');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password', { exact: true }).fill('e2e-password-123');
    await page.getByLabel('Confirm password').fill('e2e-password-123');
    await page.getByRole('button', { name: 'Create organization' }).click();

    await expect(page).toHaveURL(/\/chat$/);
    await expect(page.getByRole('heading', { name: 'Welcome, Priya' })).toBeVisible();
    await expect(page.getByText('0 of 5 done')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Copy snippet' })).toBeVisible();
    await expect(page.locator('pre code')).toContainText('widget.js');
    await expect(page.locator('aside').getByRole('link', { name: 'Tickets' })).toHaveCount(0);
  });

  test('an admin turns Desk on from the switcher and lands in the ticket queue', async ({ page, request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    await logIn(page, org);
    await expect(page).toHaveURL(/\/chat$/);

    await page.getByRole('navigation', { name: 'Products' }).getByRole('link', { name: 'Desk' }).click();
    await expect(page).toHaveURL(/\/products\/desk$/);
    await page.getByRole('button', { name: 'Turn on Desk' }).click();

    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.getByRole('heading', { name: 'Tickets', exact: true })).toBeVisible();
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
