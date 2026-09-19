const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
}

function serviceToken(orgId, overrides = {}) {
  return jwt.sign({ typ: 'service', orgId, ...overrides }, JWT_SECRET, { expiresIn: '1h' });
}

function ticketPayload() {
  return {
    customerName: 'Chatbot Customer',
    customerEmail: `${unique('bot')}@example.com`,
    subject: unique('Raised from chat'),
    description: 'Opened by the chatbot on the customer behalf.',
    priority: 'medium',
  };
}

test.describe('service token scope', () => {
  test('can create a ticket', async ({ request }) => {
    const org = await createOrg(request);
    const orgId = jwt.verify(org.token, JWT_SECRET).orgId;

    const res = await request.post(`${API_URL}/tickets`, {
      headers: auth(serviceToken(orgId)),
      data: ticketPayload(),
    });

    expect(res.status()).toBe(201);
    const ticket = await res.json();
    expect(ticket.id).toBeTruthy();

    // And the agent can see what the chatbot raised.
    const list = await request.get(`${API_URL}/tickets`, { headers: auth(org.token) });
    expect((await list.json()).tickets.some((t) => t.id === ticket.id)).toBe(true);
  });

  // The whole point: the token this replaces could read the entire queue.
  test('cannot read the ticket queue', async ({ request }) => {
    const org = await createOrg(request);
    const orgId = jwt.verify(org.token, JWT_SECRET).orgId;
    await createTicket(request, org.token);

    const res = await request.get(`${API_URL}/tickets`, { headers: auth(serviceToken(orgId)) });
    expect(res.status()).toBe(401);
  });

  test('cannot read a single ticket, update one, comment or apply a macro', async ({ request }) => {
    const org = await createOrg(request);
    const orgId = jwt.verify(org.token, JWT_SECRET).orgId;
    const ticket = await createTicket(request, org.token);
    const token = serviceToken(orgId);

    const read = await request.get(`${API_URL}/tickets/${ticket.id}`, { headers: auth(token) });
    expect(read.status()).toBe(401);

    const update = await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(token),
      data: { status: 'closed' },
    });
    expect(update.status()).toBe(401);

    const comment = await request.post(`${API_URL}/tickets/${ticket.id}/comments`, {
      headers: auth(token),
      data: { body: 'should not be possible' },
    });
    expect(comment.status()).toBe(401);

    const macro = await request.post(`${API_URL}/tickets/${ticket.id}/apply-macro`, {
      headers: auth(token),
      data: { macroId: 1 },
    });
    expect(macro.status()).toBe(401);
  });

  test('cannot reach customers, agents, macros, views, SLA, search or analytics', async ({
    request,
  }) => {
    const org = await createOrg(request);
    const orgId = jwt.verify(org.token, JWT_SECRET).orgId;
    const token = serviceToken(orgId);

    const paths = [
      '/customers',
      '/agents',
      '/macros',
      '/views',
      '/tags',
      '/sla/policies',
      '/search?q=anything',
      '/analytics/overview',
      '/admin/organizations',
    ];

    for (const path of paths) {
      const res = await request.get(`${API_URL}${path}`, { headers: auth(token) });
      expect(res.status(), `${path} must refuse a service token`).toBe(401);
    }
  });

  test('is confined to its own org', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const orgAId = jwt.verify(orgA.token, JWT_SECRET).orgId;

    const res = await request.post(`${API_URL}/tickets`, {
      headers: auth(serviceToken(orgAId)),
      data: ticketPayload(),
    });
    const ticket = await res.json();

    // It landed in org A, so org B cannot see it.
    const otherOrg = await request.get(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(orgB.token),
    });
    expect(otherOrg.status()).toBe(404);
  });

  test('an agent token still creates tickets, and a customer token still cannot', async ({
    request,
  }) => {
    const org = await createOrg(request);

    const byAgent = await request.post(`${API_URL}/tickets`, {
      headers: auth(org.token),
      data: ticketPayload(),
    });
    expect(byAgent.status()).toBe(201);

    // The create route now accepts two audiences, so it is worth pinning that
    // it did not quietly start accepting a third.
    const customerish = jwt.sign({ typ: 'customer', orgId: 1, email: 'x@example.com' }, JWT_SECRET, {
      expiresIn: '1h',
    });
    const byCustomer = await request.post(`${API_URL}/tickets`, {
      headers: auth(customerish),
      data: ticketPayload(),
    });
    expect(byCustomer.status()).toBe(401);
  });

  test('a token with no typ claim is still refused on the create route', async ({ request }) => {
    const legacy = jwt.sign({ agentId: 1, orgId: 1, role: 'agent' }, JWT_SECRET, {
      expiresIn: '1h',
    });

    const res = await request.post(`${API_URL}/tickets`, {
      headers: auth(legacy),
      data: ticketPayload(),
    });
    expect(res.status()).toBe(401);
  });
});
