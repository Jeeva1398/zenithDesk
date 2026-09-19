const { test, expect } = require('@playwright/test');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique } = require('../helpers');

test.describe('rate limiting', () => {
  test('repeated failed logins are throttled', async ({ request }) => {
    const email = `${unique('brute')}@example.com`;
    const headers = { 'X-ZenithDesk-Client-IP': uniqueClientIp() };
    const statuses = [];

    for (let i = 0; i < 12; i += 1) {
      const res = await request.post(`${API_URL}/auth/login`, {
        headers,
        data: { email, password: 'definitely-wrong-password' },
      });
      statuses.push(res.status());
    }

    expect(statuses.slice(0, 10).every((s) => s === 401)).toBe(true);
    expect(statuses[10]).toBe(429);
  });

  test('OTP requests are throttled per end user', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const headers = { 'X-ZenithDesk-Client-IP': uniqueClientIp() };

    const orgRes = await request.post(`${API_URL}/customer-auth/resolve-org`, {
      headers,
      data: { email: ticket.customerEmail },
    });
    const { orgId } = await orgRes.json();

    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      // A fresh address each time, so this measures the per-IP HTTP limiter
      // rather than the per-email cap in customerAuth.service.
      const res = await request.post(`${API_URL}/customer-auth/request-otp`, {
        headers,
        data: { orgId, email: `${unique('otp')}@example.com` },
      });
      statuses.push(res.status());
    }

    expect(statuses[5]).toBe(429);
  });

  test("one end user's OTP limit does not spend another's", async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const orgRes = await request.post(`${API_URL}/customer-auth/resolve-org`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: { email: ticket.customerEmail },
    });
    const { orgId } = await orgRes.json();

    // Exhaust one end user's bucket.
    const noisy = { 'X-ZenithDesk-Client-IP': uniqueClientIp() };
    for (let i = 0; i < 6; i += 1) {
      await request.post(`${API_URL}/customer-auth/request-otp`, {
        headers: noisy,
        data: { orgId, email: `${unique('noisy')}@example.com` },
      });
    }

    // A different end user, same source host, must be unaffected. Before the
    // trusted-service-IP key this shared one bucket, so the chatbot's users
    // could lock each other out.
    const quiet = { 'X-ZenithDesk-Client-IP': uniqueClientIp() };
    const res = await request.post(`${API_URL}/customer-auth/request-otp`, {
      headers: quiet,
      data: { orgId, email: `${unique('quiet')}@example.com` },
    });

    expect(res.status()).toBe(200);
  });

  test('requests with no client-IP header fall back to one shared bucket', async ({ request }) => {
    // The other half of endUserIpKey: without a declared end user, everything
    // from one address shares a bucket — which is what keeps the header from
    // being a way to opt out of limiting. (An untrusted source is refused the
    // header entirely; that branch can't be exercised from here, since the
    // suite necessarily calls from the trusted loopback address.)
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const orgRes = await request.post(`${API_URL}/customer-auth/resolve-org`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: { email: ticket.customerEmail },
    });
    const { orgId } = await orgRes.json();

    const statuses = [];
    for (let i = 0; i < 6; i += 1) {
      const res = await request.post(`${API_URL}/customer-auth/request-otp`, {
        data: { orgId, email: `${unique('shared')}@example.com` },
      });
      statuses.push(res.status());
    }

    expect(statuses[5]).toBe(429);
  });
});

test.describe('request validation', () => {
  test('a malformed JSON body reports what was wrong', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: '{"email": broken',
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('not valid JSON');
  });

  test('an oversized body is rejected with a real message', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/login`, {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ email: 'a@b.c', password: 'x'.repeat(200_000) }),
    });

    expect(res.status()).toBe(413);
    expect((await res.json()).error).toContain('too large');
  });
});

test.describe('password policy', () => {
  test('signup rejects a password under 8 characters', async ({ request }) => {
    const res = await request.post(`${API_URL}/organizations/signup`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: {
        orgName: unique('Org'),
        adminName: 'Short Password',
        adminEmail: `${unique('short')}@example.com`,
        adminPassword: 'short',
      },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('at least 8');
  });

  test('signup rejects a password over 72 bytes', async ({ request }) => {
    const res = await request.post(`${API_URL}/organizations/signup`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: {
        orgName: unique('Org'),
        adminName: 'Long Password',
        adminEmail: `${unique('long')}@example.com`,
        adminPassword: 'a'.repeat(80),
      },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('72 bytes');
  });
});

test.describe('security headers', () => {
  test('helmet headers are present on API responses', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    const headers = res.headers();

    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['content-security-policy']).toBeTruthy();
    expect(headers['strict-transport-security']).toBeTruthy();
  });
});

test.describe('CORS', () => {
  test('an origin outside the allowlist is refused', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`, {
      headers: { Origin: 'http://evil.example' },
    });

    expect(res.status()).toBe(403);
  });

  test('a request with no Origin is allowed through', async ({ request }) => {
    const res = await request.get(`${API_URL}/health`);
    expect(res.ok()).toBeTruthy();
  });
});
