const { test, expect } = require('@playwright/test');
const { createOrg, createTicket, readOtpFromLog, uniqueClientIp } = require('../helpers');

test.use({
  extraHTTPHeaders: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
});

test.describe('customer portal', () => {
  test('a customer signs in with an emailed code and sees their ticket', async ({
    page,
    request,
  }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    await page.goto('/portal/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(ticket.customerEmail);
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.getByRole('heading', { name: /enter verification code/i })).toBeVisible();

    // No mail provider is configured in the test environment, so the server
    // logs the code instead of sending it.
    const code = await readOtpFromLog(ticket.customerEmail);

    await page.getByRole('textbox', { name: /6-digit code/i }).fill(code);
    await page.getByRole('button', { name: /verify and continue/i }).click();

    await expect(page).toHaveURL(/\/portal\/tickets$/);
    await expect(page.getByText(ticket.subject)).toBeVisible();
  });

  test('a wrong code is refused and the customer stays on the code step', async ({
    page,
    request,
  }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    await page.goto('/portal/login');
    await page.getByRole('textbox', { name: 'Email' }).fill(ticket.customerEmail);
    await page.getByRole('button', { name: /send verification code/i }).click();
    await expect(page.getByRole('heading', { name: /enter verification code/i })).toBeVisible();

    const realCode = await readOtpFromLog(ticket.customerEmail);
    const wrongCode = realCode === '000000' ? '111111' : '000000';

    await page.getByRole('textbox', { name: /6-digit code/i }).fill(wrongCode);
    await page.getByRole('button', { name: /verify and continue/i }).click();

    await expect(page).toHaveURL(/\/portal\/login$/);
    await expect(page.getByRole('heading', { name: /enter verification code/i })).toBeVisible();
  });

  test('an unknown email is told there is no account', async ({ page }) => {
    await page.goto('/portal/login');
    await page.getByRole('textbox', { name: 'Email' }).fill('nobody-here@example.com');
    await page.getByRole('button', { name: /send verification code/i }).click();

    await expect(page.getByText(/no account found/i)).toBeVisible();
  });

  test('the portal cannot be reached without verifying', async ({ page }) => {
    await page.goto('/portal/tickets');
    await expect(page).toHaveURL(/\/portal\/login$/);
  });
});
