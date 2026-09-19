const { test, expect } = require('@playwright/test');
const { createOrg, createTicket, uniqueClientIp } = require('../helpers');

// Each browser context declares its own end-user IP so the API's per-IP
// limits are scoped to the test rather than shared across the whole suite.
test.use({
  extraHTTPHeaders: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
});

async function loginAsAgent(page, org) {
  await page.goto('/login');
  await page.getByRole('textbox', { name: 'Email' }).fill(org.adminEmail);
  await page.getByRole('textbox', { name: 'Password' }).fill(org.password);
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/tickets$/);
}

test.describe('agent dashboard', () => {
  test('an agent can log in and see their org tickets', async ({ page, request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    await loginAsAgent(page, org);

    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
    await expect(page.getByText(ticket.subject)).toBeVisible();
  });

  test('wrong credentials keep the agent on the login page', async ({ page, request }) => {
    const org = await createOrg(request);

    await page.goto('/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(org.adminEmail);
    await page.getByRole('textbox', { name: 'Password' }).fill('not-the-right-password');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText(/invalid email or password/i)).toBeVisible();
  });

  test('an agent can open a ticket and post a reply', async ({ page, request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    await loginAsAgent(page, org);
    await page.getByText(ticket.subject).click();

    await expect(page).toHaveURL(new RegExp(`/tickets/${ticket.id}$`));
    await expect(page.getByText(ticket.description)).toBeVisible();

    const reply = 'Thanks for reporting this — taking a look now.';
    await page.getByPlaceholder('Add a reply…').fill(reply);
    await page.getByRole('button', { name: 'Post reply' }).click();

    await expect(page.getByText(reply)).toBeVisible();
  });

  // A stale access token used to mean the session was over. Now that access
  // tokens are short-lived by design, expiring is the ordinary case: the app
  // renews in place and the agent never sees it.
  test('a stale access token is renewed without signing the agent out', async ({
    page,
    request,
  }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    await loginAsAgent(page, org);

    const before = await page.evaluate(
      () => JSON.parse(localStorage.getItem('zenithdesk_auth')).refreshToken,
    );
    expect(before).toBeTruthy();

    await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('zenithdesk_auth'));
      stored.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VudElkIjoxfQ.not-a-valid-signature';
      localStorage.setItem('zenithdesk_auth', JSON.stringify(stored));
    });

    await page.goto('/tickets');

    await expect(page).toHaveURL(/\/tickets$/);
    await expect(page.getByText(ticket.subject)).toBeVisible();

    // Rotation means the stored pair must both have moved on.
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('zenithdesk_auth')));
    expect(after.refreshToken).not.toBe(before);
    expect(after.token).not.toContain('not-a-valid-signature');
  });

  test('when the refresh token is dead too, the agent is returned to login', async ({
    page,
    request,
  }) => {
    const org = await createOrg(request);
    await createTicket(request, org.token);
    await loginAsAgent(page, org);

    // Both halves unusable: nothing left to renew with, so this is a real
    // sign-out rather than a renewable expiry.
    await page.evaluate(() => {
      const stored = JSON.parse(localStorage.getItem('zenithdesk_auth'));
      stored.token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhZ2VudElkIjoxfQ.not-a-valid-signature';
      stored.refreshToken = 'f'.repeat(64);
      localStorage.setItem('zenithdesk_auth', JSON.stringify(stored));
    });

    await page.goto('/tickets');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Log in' })).toBeVisible();
  });

  test('logging in again after being signed out works', async ({ page, request }) => {
    const org = await createOrg(request);
    await createTicket(request, org.token);

    await loginAsAgent(page, org);
    await page.evaluate(() => localStorage.removeItem('zenithdesk_auth'));
    await page.goto('/tickets');
    await expect(page).toHaveURL(/\/login$/);

    await loginAsAgent(page, org);
    await expect(page.getByRole('heading', { name: 'Tickets' })).toBeVisible();
  });
});
