const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique, PASSWORD } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

function headers() {
  return { 'X-ZenithDesk-Client-IP': uniqueClientIp() };
}

function auth(token) {
  return { Authorization: `Bearer ${token}`, ...headers() };
}

async function refresh(request, refreshToken) {
  const res = await request.post(`${API_URL}/auth/refresh`, {
    headers: headers(),
    data: { refreshToken },
  });
  return { res, body: await res.json().catch(() => ({})) };
}

test.describe('refresh tokens', () => {
  test('login hands back a refresh token alongside the access token', async ({ request }) => {
    const org = await createOrg(request);
    expect(org.token).toBeTruthy();
    expect(typeof org.refreshToken).toBe('string');
    expect(org.refreshToken.length).toBeGreaterThan(32);

    // Opaque, not a JWT - there is nothing in it to read.
    expect(org.refreshToken.includes('.')).toBe(false);
  });

  test('a refresh yields a working access token and a new refresh token', async ({ request }) => {
    const org = await createOrg(request);
    const { res, body } = await refresh(request, org.refreshToken);

    expect(res.status()).toBe(200);
    expect(body.token).toBeTruthy();
    expect(body.refreshToken).toBeTruthy();
    expect(body.refreshToken).not.toBe(org.refreshToken);
    expect(body.agent.orgName).toBeTruthy();

    const used = await request.get(`${API_URL}/tickets`, { headers: auth(body.token) });
    expect(used.status()).toBe(200);
  });

  test('the old refresh token stops working once rotated', async ({ request }) => {
    const org = await createOrg(request);
    const first = await refresh(request, org.refreshToken);
    expect(first.res.status()).toBe(200);

    const replay = await refresh(request, org.refreshToken);
    expect(replay.res.status()).toBe(401);
  });

  // Reuse is either a replay or a stolen token, and the server cannot tell
  // which - so it ends every session the agent has and makes them log in again.
  test('reusing a rotated token cuts the whole family', async ({ request }) => {
    const org = await createOrg(request);

    const first = await refresh(request, org.refreshToken);
    const live = first.body.refreshToken;

    // The live token still works right up to the moment the old one is reused.
    const replay = await refresh(request, org.refreshToken);
    expect(replay.res.status()).toBe(401);

    const afterBreach = await refresh(request, live);
    expect(afterBreach.res.status()).toBe(401);
  });

  test('an unknown refresh token is refused', async ({ request }) => {
    const { res } = await refresh(request, 'a'.repeat(64));
    expect(res.status()).toBe(401);
  });

  test('a missing refresh token is a 400, not a 500', async ({ request }) => {
    const res = await request.post(`${API_URL}/auth/refresh`, { headers: headers(), data: {} });
    expect(res.status()).toBe(400);
  });

  test('logout revokes the token, and is idempotent', async ({ request }) => {
    const org = await createOrg(request);

    const out = await request.post(`${API_URL}/auth/logout`, {
      headers: headers(),
      data: { refreshToken: org.refreshToken },
    });
    expect(out.status()).toBe(204);

    const afterLogout = await refresh(request, org.refreshToken);
    expect(afterLogout.res.status()).toBe(401);

    // Logging out twice is not an error - the caller wanted it gone, it is gone.
    const again = await request.post(`${API_URL}/auth/logout`, {
      headers: headers(),
      data: { refreshToken: org.refreshToken },
    });
    expect(again.status()).toBe(204);
  });

  test('logging out one session leaves another alone', async ({ request }) => {
    const org = await createOrg(request);

    const second = await request.post(`${API_URL}/auth/login`, {
      headers: headers(),
      data: { email: org.adminEmail, password: PASSWORD },
    });
    const otherSession = await second.json();

    await request.post(`${API_URL}/auth/logout`, {
      headers: headers(),
      data: { refreshToken: org.refreshToken },
    });

    const stillGood = await refresh(request, otherSession.refreshToken);
    expect(stillGood.res.status()).toBe(200);
  });

  test('a refresh token is not an access token', async ({ request }) => {
    const org = await createOrg(request);

    const res = await request.get(`${API_URL}/tickets`, { headers: auth(org.refreshToken) });
    expect(res.status()).toBe(401);
  });

  test('an access token is not a refresh token', async ({ request }) => {
    const org = await createOrg(request);
    const { res } = await refresh(request, org.token);
    expect(res.status()).toBe(401);
  });

  test('the renewed access token is scoped to the same org', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketB = await createTicket(request, orgB.token);

    const { body } = await refresh(request, orgA.refreshToken);
    const payload = jwt.verify(body.token, JWT_SECRET);
    expect(payload.typ).toBe('agent');
    expect(payload.orgId).toBe(jwt.verify(orgA.token, JWT_SECRET).orgId);

    const crossOrg = await request.get(`${API_URL}/tickets/${ticketB.id}`, {
      headers: auth(body.token),
    });
    expect(crossOrg.status()).toBe(404);
  });

  test('a non-admin agent can refresh too, and keeps their role', async ({ request }) => {
    const org = await createOrg(request);
    const email = `${unique('plain')}@example.com`;
    await request.post(`${API_URL}/agents`, {
      headers: auth(org.token),
      data: { name: 'Plain Agent', email, password: PASSWORD, role: 'agent' },
    });

    const login = await request.post(`${API_URL}/auth/login`, {
      headers: headers(),
      data: { email, password: PASSWORD },
    });
    const session = await login.json();

    const { res, body } = await refresh(request, session.refreshToken);
    expect(res.status()).toBe(200);
    expect(jwt.verify(body.token, JWT_SECRET).role).toBe('agent');

    // Still not an admin after renewing.
    const adminOnly = await request.post(`${API_URL}/agents`, {
      headers: auth(body.token),
      data: { name: 'Nope', email: `${unique('nope')}@example.com`, password: PASSWORD },
    });
    expect(adminOnly.status()).toBe(403);
  });
});
