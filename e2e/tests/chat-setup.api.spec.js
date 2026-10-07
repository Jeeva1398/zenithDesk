const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, uniqueClientIp, unique } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

// The Chat home page's setup checklist. Each step is worked out from what the
// org has; "installed" comes from the chat server reporting a page that
// loaded the widget.

const PLATFORM = jwt.sign({ typ: 'service', scope: 'platform' }, JWT_SECRET, { expiresIn: '1h' });
const SITE = 'https://shop.example.com';

function auth(token, widgetKey) {
  const headers = { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
  if (widgetKey) headers['X-Widget-Key'] = widgetKey;
  return headers;
}

async function setupOf(request, org) {
  const res = await request.get(`${API_URL}/chat-widget/setup`, { headers: auth(org.token) });
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('chat setup checklist', () => {
  test('a new chat-only org starts with nothing done', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const setup = await setupOf(request, org);
    expect(setup.publicKey).toMatch(/^zdw_/);
    expect(setup.steps).toEqual({
      branded: false,
      purposes: false,
      knowledge: false,
      allowedSites: false,
      installed: false,
      teammate: false,
    });
    expect(setup.install).toEqual({ firstSeenAt: null, lastSeenAt: null, lastSeenOrigin: null });
  });

  test('each step is done once the org has what it asks for', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const headers = auth(org.token);

    expect(
      (await request.patch(`${API_URL}/chat-widget`, { headers, data: { theme: { primaryColor: '#0f766e' } } })).status(),
    ).toBe(200);
    expect(
      (await request.patch(`${API_URL}/chat-widget`, { headers, data: { bot: { companyDescription: 'We sell tea.' } } })).status(),
    ).toBe(200);
    expect(
      (await request.post(`${API_URL}/knowledge/articles`, { headers, data: { title: 'Shipping', body: 'We ship in 3 days.' } })).status(),
    ).toBe(201);
    expect((await request.patch(`${API_URL}/chat-widget`, { headers, data: { allowedDomains: [SITE] } })).status()).toBe(200);
    expect(
      (
        await request.post(`${API_URL}/agents`, {
          headers,
          data: { name: 'Teammate', email: `${unique('agent')}@example.com`, password: 'agent-password-123', role: 'agent' },
        })
      ).status(),
    ).toBe(201);

    const setup = await setupOf(request, org);
    expect(setup.steps).toEqual({
      branded: true,
      purposes: true,
      knowledge: true,
      allowedSites: true,
      installed: false,
      teammate: true,
    });
  });

  test('the chat server marks it installed when an allowed site loads the widget', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const headers = auth(org.token);
    const { publicKey } = await (
      await request.patch(`${API_URL}/chat-widget`, { headers, data: { allowedDomains: [SITE] } })
    ).json();
    const seen = (origin) =>
      request.post(`${API_URL}/chat-widget/seen`, { headers: auth(PLATFORM, publicKey), data: { origin } });

    expect((await seen('https://elsewhere.example.com')).status()).toBe(400);
    expect((await seen('')).status()).toBe(400);
    expect((await setupOf(request, org)).steps.installed).toBe(false);

    expect((await seen(SITE)).status()).toBe(204);
    const first = await setupOf(request, org);
    expect(first.steps.installed).toBe(true);
    expect(first.install.lastSeenOrigin).toBe(SITE);
    expect(first.install.firstSeenAt).not.toBeNull();

    // Seen again later: the first sighting stays, the latest moves on.
    expect((await seen(SITE)).status()).toBe(204);
    const again = await setupOf(request, org);
    expect(again.install.firstSeenAt).toBe(first.install.firstSeenAt);
  });

  test('only the chat server can say where the widget loaded', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const headers = auth(org.token);
    await request.patch(`${API_URL}/chat-widget`, { headers, data: { allowedDomains: [SITE] } });

    const res = await request.post(`${API_URL}/chat-widget/seen`, { headers, data: { origin: SITE } });
    expect(res.status()).toBe(403);
  });

  test('a desk-only org has no chat setup', async ({ request }) => {
    const org = await createOrg(request, { products: ['desk'] });
    const res = await request.get(`${API_URL}/chat-widget/setup`, { headers: auth(org.token) });
    expect(res.status()).toBe(403);
  });
});
