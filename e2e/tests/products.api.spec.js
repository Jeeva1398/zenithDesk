const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

// An org uses Desk, Chat or both. What belongs to a product it does not have
// answers 403 product_not_enabled; what the two share works either way.

const PLATFORM = jwt.sign({ typ: 'service', scope: 'platform' }, JWT_SECRET, { expiresIn: '1h' });

function auth(token, widgetKey) {
  const headers = { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
  if (widgetKey) headers['X-Widget-Key'] = widgetKey;
  return headers;
}

async function expectNotEnabled(res) {
  expect(res.status()).toBe(403);
  expect((await res.json()).code).toBe('product_not_enabled');
}

test.describe('products', () => {
  test('signing up without choosing gives both products', async ({ request }) => {
    const org = await createOrg(request);
    expect(org.agent.products).toEqual(['desk', 'chat']);

    const me = await request.get(`${API_URL}/organizations/me`, { headers: auth(org.token) });
    expect(me.status()).toBe(200);
    expect(await me.json()).toEqual({ id: org.agent.orgId, name: org.orgName, products: ['desk', 'chat'] });
  });

  test('login and refresh say which products the org has', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });

    const login = await request.post(`${API_URL}/auth/login`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: { email: org.adminEmail, password: org.password },
    });
    expect((await login.json()).agent.products).toEqual(['chat']);

    const refreshed = await request.post(`${API_URL}/auth/refresh`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: { refreshToken: org.refreshToken },
    });
    expect((await refreshed.json()).agent.products).toEqual(['chat']);
  });

  test('a product list that is empty or unknown is refused', async ({ request }) => {
    for (const products of [[], ['crm'], 'chat']) {
      const res = await request.post(`${API_URL}/organizations/signup`, {
        headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
        data: {
          orgName: unique('Org'),
          adminName: 'E2E Admin',
          adminEmail: `${unique('admin')}@example.com`,
          adminPassword: 'e2e-password-123',
          products,
        },
      });
      expect(res.status()).toBe(400);
    }
  });

  test('a chat-only org reaches Chat and the shared parts, not Desk', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const headers = auth(org.token);

    for (const path of ['/tickets', '/sla/policies', '/macros', '/views', '/tags', '/analytics/overview']) {
      await expectNotEnabled(await request.get(`${API_URL}${path}`, { headers }));
    }

    for (const path of ['/chat-widget', '/enquiries', '/live-chats/counts', '/analytics/chatbot', '/customers', '/agents', '/knowledge/articles']) {
      expect((await request.get(`${API_URL}${path}`, { headers })).status(), path).toBe(200);
    }

    const search = await request.get(`${API_URL}/search?q=anything`, { headers });
    expect(search.status()).toBe(200);
    expect((await search.json()).tickets).toEqual([]);
  });

  test("a chat-only org's bot cannot raise tickets, but its widget works", async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const { publicKey } = await (await request.get(`${API_URL}/chat-widget`, { headers: auth(org.token) })).json();

    const pub = await request.get(`${API_URL}/chat-widget/public/${publicKey}`);
    expect(pub.status()).toBe(200);
    expect((await pub.json()).products).toEqual(['chat']);

    const ticket = await request.post(`${API_URL}/tickets`, {
      headers: auth(PLATFORM, publicKey),
      data: {
        customerName: 'Visitor',
        customerEmail: `${unique('visitor')}@example.com`,
        subject: 'Help',
        description: 'From the widget.',
        category: 'technical',
        priority: 'medium',
      },
    });
    await expectNotEnabled(ticket);

    const bot = await request.patch(`${API_URL}/chat-widget`, {
      headers: auth(org.token),
      data: { bot: { purposes: { enquiry: true } } },
    });
    expect(bot.status()).toBe(200);
    const enquiry = await request.post(`${API_URL}/enquiries`, {
      headers: auth(PLATFORM, publicKey),
      data: { name: 'Visitor', email: `${unique('visitor')}@example.com`, message: 'Tell me about pricing.' },
    });
    expect(enquiry.status()).toBe(201);
  });

  test("a chat-only org's bot starts without tickets and cannot be given them", async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const headers = auth(org.token);

    const widget = await (await request.get(`${API_URL}/chat-widget`, { headers })).json();
    expect(widget.bot.purposes).toEqual({ enquiry: true, support: false, knowledge: true, status: false });
    const pub = await (await request.get(`${API_URL}/chat-widget/public/${widget.publicKey}`)).json();
    expect(pub.bot.purposes).toEqual({ enquiry: true, support: false, knowledge: true, status: false });

    for (const purpose of ['support', 'status']) {
      const res = await request.patch(`${API_URL}/chat-widget`, {
        headers,
        data: { bot: { purposes: { [purpose]: true } } },
      });
      expect(res.status(), purpose).toBe(400);
      expect((await res.json()).error).toMatch(/ZenithDesk Desk/);
    }

    // Answers only is a whole bot: what it cannot answer becomes a message.
    const answersOnly = await request.patch(`${API_URL}/chat-widget`, {
      headers,
      data: { bot: { purposes: { enquiry: false } } },
    });
    expect(answersOnly.status()).toBe(200);
  });

  test('turning Desk on leaves the bot as it was, for the admin to change', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const headers = auth(org.token);

    await request.post(`${API_URL}/organizations/me/products`, { headers, data: { product: 'desk' } });
    const widget = await (await request.get(`${API_URL}/chat-widget`, { headers })).json();
    expect(widget.bot.purposes).toEqual({ enquiry: true, support: false, knowledge: true, status: false });

    const support = await request.patch(`${API_URL}/chat-widget`, {
      headers,
      data: { bot: { purposes: { support: true, status: true } } },
    });
    expect(support.status()).toBe(200);
    expect((await support.json()).bot.purposes.support).toBe(true);
  });

  test('a desk-only org reaches Desk, not Chat', async ({ request }) => {
    const org = await createOrg(request, { products: ['desk'] });
    const headers = auth(org.token);

    expect((await request.get(`${API_URL}/tickets`, { headers })).status()).toBe(200);
    expect((await request.get(`${API_URL}/sla/policies`, { headers })).status()).toBe(200);

    for (const path of ['/chat-widget', '/enquiries', '/live-chats', '/analytics/chatbot']) {
      await expectNotEnabled(await request.get(`${API_URL}${path}`, { headers }));
    }
  });

  test('a customer of a chat-only org has no portal to sign in to', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const res = await request.post(`${API_URL}/customer-auth/request-otp`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: { orgId: org.agent.orgId, email: `${unique('visitor')}@example.com` },
    });
    await expectNotEnabled(res);
  });

  test('an admin turns Desk on, and it arrives with its SLA targets', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const headers = auth(org.token);

    const enabled = await request.post(`${API_URL}/organizations/me/products`, { headers, data: { product: 'desk' } });
    expect(enabled.status()).toBe(200);
    expect((await enabled.json()).products).toEqual(['desk', 'chat']);

    const policies = await request.get(`${API_URL}/sla/policies`, { headers });
    expect(policies.status()).toBe(200);
    expect((await policies.json()).policies).toHaveLength(4);

    await createTicket(request, org.token);

    // Again changes nothing, and does not seed the targets twice.
    const again = await request.post(`${API_URL}/organizations/me/products`, { headers, data: { product: 'desk' } });
    expect(again.status()).toBe(200);
    expect((await (await request.get(`${API_URL}/sla/policies`, { headers })).json()).policies).toHaveLength(4);
  });

  test('only an admin may turn a product on, and only a real one', async ({ request }) => {
    const org = await createOrg(request, { products: ['chat'] });
    const agentEmail = `${unique('agent')}@example.com`;
    const created = await request.post(`${API_URL}/agents`, {
      headers: auth(org.token),
      data: { name: 'Agent', email: agentEmail, password: 'agent-password-123', role: 'agent' },
    });
    expect(created.status()).toBe(201);
    const login = await request.post(`${API_URL}/auth/login`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: { email: agentEmail, password: 'agent-password-123' },
    });
    const agentToken = (await login.json()).token;

    const byAgent = await request.post(`${API_URL}/organizations/me/products`, {
      headers: auth(agentToken),
      data: { product: 'desk' },
    });
    expect(byAgent.status()).toBe(403);

    const unknown = await request.post(`${API_URL}/organizations/me/products`, {
      headers: auth(org.token),
      data: { product: 'crm' },
    });
    expect(unknown.status()).toBe(400);
  });
});
