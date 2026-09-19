const { test, expect } = require('@playwright/test');
const path = require('path');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique } = require('../helpers');

const searchService = require(
  path.resolve(__dirname, '..', '..', 'server', 'src', 'services', 'search.service'),
);

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
}

async function find(request, token, q, limit) {
  const params = new URLSearchParams({ q });
  if (limit) params.set('limit', String(limit));
  const res = await request.get(`${API_URL}/search?${params.toString()}`, {
    headers: auth(token),
  });
  return { res, body: await res.json() };
}

test.describe('global search', () => {
  test('finds a ticket by a word in its subject', async ({ request }) => {
    const org = await createOrg(request);
    const marker = unique('Zappadoodle');
    const ticket = await createTicket(request, org.token, { subject: `Broken ${marker} widget` });

    const { res, body } = await find(request, org.token, marker);
    expect(res.status()).toBe(200);
    expect(body.tickets.some((t) => t.id === ticket.id)).toBe(true);
  });

  test('finds a ticket by its description', async ({ request }) => {
    const org = await createOrg(request);
    const marker = unique('Flibbertigibbet');
    const ticket = await createTicket(request, org.token, {
      description: `The ${marker} keeps failing.`,
    });

    const { body } = await find(request, org.token, marker);
    expect(body.tickets.some((t) => t.id === ticket.id)).toBe(true);
  });

  test('finds a ticket by its customer email', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const { body } = await find(request, org.token, ticket.customerEmail);
    expect(body.tickets.some((t) => t.id === ticket.id)).toBe(true);
    expect(body.customers.some((c) => c.email === ticket.customerEmail)).toBe(true);
  });

  test('finds a ticket by tag', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const tag = unique('urgenttag');

    await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
      data: { tagNames: [tag] },
    });

    const { body } = await find(request, org.token, tag);
    expect(body.tickets.some((t) => t.id === ticket.id)).toBe(true);
  });

  test('finds a ticket by #id and by bare id', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    for (const term of [`#${ticket.id}`, String(ticket.id)]) {
      const { body } = await find(request, org.token, term);
      expect(body.tickets[0]?.id, `term ${term}`).toBe(ticket.id);
    }
  });

  test('a query shorter than two characters is refused', async ({ request }) => {
    const org = await createOrg(request);
    const { res } = await find(request, org.token, 'a');
    expect(res.status()).toBe(400);

    const missing = await request.get(`${API_URL}/search`, { headers: auth(org.token) });
    expect(missing.status()).toBe(400);
  });

  test('wildcards are matched literally, not as wildcards', async ({ request }) => {
    const org = await createOrg(request);
    const plain = await createTicket(request, org.token, { subject: unique('Plain subject') });
    const percent = await createTicket(request, org.token, {
      subject: `Refund 50% ${unique('owed')}`,
    });

    // If % leaked through as a wildcard this would match every ticket in the org.
    const { body } = await find(request, org.token, '50%');
    expect(body.tickets.some((t) => t.id === percent.id)).toBe(true);
    expect(body.tickets.some((t) => t.id === plain.id)).toBe(false);
  });

  test('underscores are matched literally too', async ({ request }) => {
    const org = await createOrg(request);
    const literal = await createTicket(request, org.token, { subject: `A_B ${unique('under')}` });
    const decoy = await createTicket(request, org.token, { subject: `AXB ${unique('decoy')}` });

    const { body } = await find(request, org.token, 'A_B');
    expect(body.tickets.some((t) => t.id === literal.id)).toBe(true);
    expect(body.tickets.some((t) => t.id === decoy.id)).toBe(false);
  });

  test('results never cross an org boundary', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const marker = unique('Quixotic');
    const ticketA = await createTicket(request, orgA.token, { subject: `${marker} problem` });

    const { body } = await find(request, orgB.token, marker);
    expect(body.tickets.some((t) => t.id === ticketA.id)).toBe(false);
    expect(body.tickets).toHaveLength(0);

    // And the customer half of the response is scoped too.
    const byEmail = await find(request, orgB.token, ticketA.customerEmail);
    expect(byEmail.body.customers).toHaveLength(0);
  });

  test('a ticket id from another org is not reachable by number', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketA = await createTicket(request, orgA.token);

    const { body } = await find(request, orgB.token, `#${ticketA.id}`);
    expect(body.tickets.some((t) => t.id === ticketA.id)).toBe(false);
  });

  test('a subject match outranks a description-only match', async ({ request }) => {
    const org = await createOrg(request);
    const marker = unique('Bellwether');
    await createTicket(request, org.token, {
      subject: unique('Unrelated'),
      description: `Mentions ${marker} only in the body.`,
    });
    const inSubject = await createTicket(request, org.token, { subject: `${marker} in subject` });

    const { body } = await find(request, org.token, marker);
    expect(body.tickets).toHaveLength(2);
    expect(body.tickets[0].id).toBe(inSubject.id);
  });

  test('the limit is honoured and capped', async ({ request }) => {
    const org = await createOrg(request);
    const marker = unique('Multimatch');
    for (let i = 0; i < 3; i += 1) {
      await createTicket(request, org.token, { subject: `${marker} ${i}` });
    }

    const limited = await find(request, org.token, marker, 2);
    expect(limited.body.tickets).toHaveLength(2);

    const overCap = await find(request, org.token, marker, 999);
    expect(overCap.body.tickets.length).toBeLessThanOrEqual(searchService.MAX_LIMIT);
  });

  test('search requires a token', async ({ request }) => {
    const res = await request.get(`${API_URL}/search?q=anything`);
    expect(res.status()).toBe(401);
  });
});

// Pure helpers, so the awkward inputs are cheaper to pin down directly.
test.describe('search input handling', () => {
  test('LIKE metacharacters are escaped', () => {
    expect(searchService.likePattern('50%')).toBe('%50\\%%');
    expect(searchService.likePattern('a_b')).toBe('%a\\_b%');
    expect(searchService.likePattern('back\\slash')).toBe('%back\\\\slash%');
  });

  test('only a bare or hashed number counts as a ticket id', () => {
    expect(searchService.asTicketId('42')).toBe(42);
    expect(searchService.asTicketId('#42')).toBe(42);
    expect(searchService.asTicketId(' #42 ')).toBe(42);
    expect(searchService.asTicketId('42a')).toBe(null);
    expect(searchService.asTicketId('#')).toBe(null);
    expect(searchService.asTicketId('printer')).toBe(null);
  });
});

// A single-digit ticket id is one character long, which the minimum-length rule
// would otherwise reject - found by the suite the first time it ran.
test.describe('single-character queries', () => {
  test('a bare single-digit ticket id is allowed through', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const res = await request.get(`${API_URL}/search?q=${ticket.id}`, {
      headers: auth(org.token),
    });
    expect(res.status()).toBe(200);
  });

  test('a single letter is still refused', async ({ request }) => {
    const org = await createOrg(request);
    const { res } = await find(request, org.token, 'a');
    expect(res.status()).toBe(400);
  });
});
