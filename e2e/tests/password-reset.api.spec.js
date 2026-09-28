const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { API_URL, createOrg, uniqueClientIp, unique } = require('../helpers');
const { SERVER_LOG } = require('../test-env');

// "Forgot password" for agents: a single-use link, emailed - or, with no mail
// provider configured, logged, which is where these tests read it from.

function ip() {
  return { 'X-ZenithDesk-Client-IP': uniqueClientIp() };
}

async function readResetToken(email, { timeoutMs = 5000 } = {}) {
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(`password reset link instead of emailing ${escaped}: \\S+token=([0-9a-f]{64})`, 'g');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const log = fs.existsSync(SERVER_LOG) ? fs.readFileSync(SERVER_LOG, 'utf8') : '';
    const matches = [...log.matchAll(pattern)];
    if (matches.length > 0) return matches[matches.length - 1][1];
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No reset link logged for ${email}`);
}

function forgot(request, email) {
  return request.post(`${API_URL}/auth/forgot-password`, { headers: ip(), data: { email } });
}

function reset(request, token, password) {
  return request.post(`${API_URL}/auth/reset-password`, { headers: ip(), data: { token, password } });
}

function login(request, email, password) {
  return request.post(`${API_URL}/auth/login`, { headers: ip(), data: { email, password } });
}

test.describe('password reset', () => {
  test('a link sets a new password, once, and signs other sessions out', async ({ request }) => {
    const org = await createOrg(request);
    const before = await (await login(request, org.adminEmail, org.password)).json();

    const res = await forgot(request, org.adminEmail);
    expect(res.status()).toBe(202);
    const token = await readResetToken(org.adminEmail);

    expect((await reset(request, token, 'brand-new-password-1')).status()).toBe(204);
    expect((await login(request, org.adminEmail, org.password)).status()).toBe(401);
    expect((await login(request, org.adminEmail, 'brand-new-password-1')).status()).toBe(200);

    // The same link does not work twice.
    expect((await reset(request, token, 'another-password-2')).status()).toBe(400);

    // The session from before the reset can no longer be renewed.
    const renewed = await request.post(`${API_URL}/auth/refresh`, {
      headers: ip(),
      data: { refreshToken: before.refreshToken },
    });
    expect(renewed.status()).toBe(401);
  });

  test('answers the same for an email with no account', async ({ request }) => {
    const org = await createOrg(request);
    const known = await forgot(request, org.adminEmail);
    const unknown = await forgot(request, `${unique('nobody')}@example.com`);
    expect(unknown.status()).toBe(known.status());
    expect(await unknown.json()).toEqual(await known.json());
  });

  test('a newer link retires the older one', async ({ request }) => {
    const org = await createOrg(request);
    await forgot(request, org.adminEmail);
    const first = await readResetToken(org.adminEmail);
    await forgot(request, org.adminEmail);
    let second = await readResetToken(org.adminEmail);
    for (let i = 0; second === first && i < 20; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      second = await readResetToken(org.adminEmail);
    }
    expect(second).not.toBe(first);

    expect((await reset(request, first, 'brand-new-password-1')).status()).toBe(400);
    expect((await reset(request, second, 'brand-new-password-1')).status()).toBe(204);
  });

  test('refuses a made-up token and a too-short password', async ({ request }) => {
    const org = await createOrg(request);
    expect((await reset(request, 'a'.repeat(64), 'brand-new-password-1')).status()).toBe(400);
    expect((await reset(request, 'not-a-token', 'brand-new-password-1')).status()).toBe(400);

    await forgot(request, org.adminEmail);
    const token = await readResetToken(org.adminEmail);
    expect((await reset(request, token, 'short')).status()).toBe(400);
    // A refused password does not use the link up.
    expect((await reset(request, token, 'long-enough-password')).status()).toBe(204);
  });

  test('asking for links is rate limited', async ({ request }) => {
    const headers = ip();
    const email = `${unique('flood')}@example.com`;
    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      statuses.push((await request.post(`${API_URL}/auth/forgot-password`, { headers, data: { email } })).status());
    }
    expect(statuses.slice(0, 5)).toEqual([202, 202, 202, 202, 202]);
    expect(statuses[5]).toBe(429);
  });
});
