const jwt = require('jsonwebtoken');
const { test, expect } = require('@playwright/test');
const { API_URL, createOrg, createTicket, loginCustomer, unique, PASSWORD } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

// These cover the privilege-escalation bug fixed in b51f3d2: `authenticate`
// verified the JWT signature but never checked which audience the token was
// issued to. Since agent, customer and super-admin tokens are all signed with
// the same secret, a customer's token satisfied it and inherited org-wide
// agent access. Each test here fails loudly if that check is ever relaxed.
test.describe('token audience separation', () => {
  test('a customer token cannot read the org ticket list', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const customer = await loginCustomer(request, ticket.customerEmail);

    // Establishes that the 401 below is the audience check doing its job and
    // not an incidentally broken token: the signature is valid, so the
    // pre-fix middleware — which only called jwt.verify — would have accepted
    // this and handed back an agent context scoped to the customer's org.
    const payload = jwt.verify(customer.token, JWT_SECRET);
    expect(payload.orgId).toBeTruthy();
    expect(payload.typ).toBe('customer');

    const res = await request.get(`${API_URL}/tickets`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    });

    expect(res.status()).toBe(401);
  });

  test('a customer token cannot read the org customer list', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const customer = await loginCustomer(request, ticket.customerEmail);

    const res = await request.get(`${API_URL}/customers`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    });

    expect(res.status()).toBe(401);
  });

  test('an agent token cannot use the customer portal endpoints', async ({ request }) => {
    const org = await createOrg(request);

    const res = await request.get(`${API_URL}/customer/tickets`, {
      headers: { Authorization: `Bearer ${org.token}` },
    });

    expect(res.status()).toBe(401);
  });

  test('an agent token cannot reach the super-admin endpoints', async ({ request }) => {
    const org = await createOrg(request);

    const res = await request.get(`${API_URL}/admin/organizations`, {
      headers: { Authorization: `Bearer ${org.token}` },
    });

    expect(res.status()).toBe(401);
  });

  test('a token with a valid signature but no typ claim is rejected', async ({ request }) => {
    // Exactly the shape this app issued before the fix.
    const legacyToken = jwt.sign(
      { agentId: 1, orgId: 1, role: 'agent', email: 'legacy@example.com' },
      JWT_SECRET,
      { expiresIn: '1h' },
    );

    const res = await request.get(`${API_URL}/tickets`, {
      headers: { Authorization: `Bearer ${legacyToken}` },
    });

    expect(res.status()).toBe(401);
  });

  test('an agent token still works on agent endpoints', async ({ request }) => {
    const org = await createOrg(request);
    await createTicket(request, org.token);

    const res = await request.get(`${API_URL}/tickets`, {
      headers: { Authorization: `Bearer ${org.token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body.tickets)).toBe(true);
  });

  test('a customer token still works on customer endpoints', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const customer = await loginCustomer(request, ticket.customerEmail);

    const res = await request.get(`${API_URL}/customer/tickets`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    });

    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.tickets.some((t) => t.id === ticket.id)).toBe(true);
  });
});

test.describe('tenant isolation', () => {
  test('an agent cannot read a ticket belonging to another org', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketA = await createTicket(request, orgA.token);

    const res = await request.get(`${API_URL}/tickets/${ticketA.id}`, {
      headers: { Authorization: `Bearer ${orgB.token}` },
    });

    expect(res.status()).toBe(404);
  });

  test("an org's ticket list contains only its own tickets", async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketA = await createTicket(request, orgA.token);
    await createTicket(request, orgB.token);

    const res = await request.get(`${API_URL}/tickets`, {
      headers: { Authorization: `Bearer ${orgB.token}` },
    });

    const { tickets } = await res.json();
    expect(tickets.some((t) => t.id === ticketA.id)).toBe(false);
  });

  test('a customer only sees their own tickets, not the org\'s', async ({ request }) => {
    const org = await createOrg(request);
    const mine = await createTicket(request, org.token);
    const someoneElse = await createTicket(request, org.token);
    const customer = await loginCustomer(request, mine.customerEmail);

    const res = await request.get(`${API_URL}/customer/tickets`, {
      headers: { Authorization: `Bearer ${customer.token}` },
    });

    const { tickets } = await res.json();
    expect(tickets.some((t) => t.id === mine.id)).toBe(true);
    expect(tickets.some((t) => t.id === someoneElse.id)).toBe(false);
  });
});

test.describe('role enforcement', () => {
  test('a non-admin agent cannot create agents', async ({ request }) => {
    const org = await createOrg(request);
    const agentEmail = `${unique('agent')}@example.com`;

    const created = await request.post(`${API_URL}/agents`, {
      headers: { Authorization: `Bearer ${org.token}` },
      data: { name: 'Plain Agent', email: agentEmail, password: PASSWORD, role: 'agent' },
    });
    expect(created.ok()).toBeTruthy();

    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email: agentEmail, password: PASSWORD },
    });
    const { token: agentToken } = await login.json();

    const res = await request.post(`${API_URL}/agents`, {
      headers: { Authorization: `Bearer ${agentToken}` },
      data: {
        name: 'Should Not Exist',
        email: `${unique('nope')}@example.com`,
        password: PASSWORD,
      },
    });

    expect(res.status()).toBe(403);
  });
});

test.describe('unauthenticated access', () => {
  const protectedPaths = [
    '/tickets',
    '/customers',
    '/agents',
    '/tags',
    '/views',
    '/analytics/overview',
    '/customer/tickets',
    '/admin/organizations',
  ];

  for (const path of protectedPaths) {
    test(`${path} requires a token`, async ({ request }) => {
      const res = await request.get(`${API_URL}${path}`);
      expect(res.status()).toBe(401);
    });
  }
});
