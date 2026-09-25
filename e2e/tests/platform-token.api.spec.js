const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

// One chatbot serving every org: its token carries no org, and each request
// names the widget it is for. These pin that the org always comes from the
// widget key, never from anything the caller could simply claim.

const PLATFORM = jwt.sign({ typ: 'service', scope: 'platform' }, JWT_SECRET, { expiresIn: '1h' });

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32, 1)]);

function auth(token, widgetKey) {
  const headers = { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
  if (widgetKey) headers['X-Widget-Key'] = widgetKey;
  return headers;
}

async function widgetKeyOf(request, org) {
  const res = await request.get(`${API_URL}/chat-widget`, { headers: auth(org.token) });
  expect(res.status()).toBe(200);
  return (await res.json()).publicKey;
}

function orgIdOf(org) {
  return jwt.verify(org.token, JWT_SECRET).orgId;
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

async function ticketIds(request, org) {
  const res = await request.get(`${API_URL}/tickets`, { headers: auth(org.token) });
  return (await res.json()).tickets.map((t) => t.id);
}

test.describe('platform service token', () => {
  test("files each ticket in the org of the widget it names", async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const [keyA, keyB] = [await widgetKeyOf(request, orgA), await widgetKeyOf(request, orgB)];

    const forA = await request.post(`${API_URL}/tickets`, { headers: auth(PLATFORM, keyA), data: ticketPayload() });
    const forB = await request.post(`${API_URL}/tickets`, { headers: auth(PLATFORM, keyB), data: ticketPayload() });
    expect(forA.status()).toBe(201);
    expect(forB.status()).toBe(201);
    const [ticketA, ticketB] = [await forA.json(), await forB.json()];

    const [idsA, idsB] = [await ticketIds(request, orgA), await ticketIds(request, orgB)];
    expect(idsA).toContain(ticketA.id);
    expect(idsA).not.toContain(ticketB.id);
    expect(idsB).toContain(ticketB.id);
    expect(idsB).not.toContain(ticketA.id);
  });

  test('is refused without a widget key, or with one that does not exist', async ({ request }) => {
    const missing = await request.post(`${API_URL}/tickets`, { headers: auth(PLATFORM), data: ticketPayload() });
    expect(missing.status()).toBe(401);

    for (const key of [`zdw_${'0'.repeat(32)}`, 'not-a-key', "zdw_' OR 1=1 --"]) {
      const res = await request.post(`${API_URL}/tickets`, { headers: auth(PLATFORM, key), data: ticketPayload() });
      expect(res.status(), `key ${key}`).toBe(403);
    }
  });

  test('a regenerated key stops working at once', async ({ request }) => {
    const org = await createOrg(request);
    const oldKey = await widgetKeyOf(request, org);
    await request.post(`${API_URL}/chat-widget/regenerate-key`, { headers: auth(org.token) });

    const res = await request.post(`${API_URL}/tickets`, { headers: auth(PLATFORM, oldKey), data: ticketPayload() });
    expect(res.status()).toBe(403);
  });

  test('still cannot read the queue, whichever widget it names', async ({ request }) => {
    const org = await createOrg(request);
    const key = await widgetKeyOf(request, org);
    const ticket = await createTicket(request, org.token);

    for (const path of ['/tickets', `/tickets/${ticket.id}`, '/customers', '/knowledge/articles']) {
      const res = await request.get(`${API_URL}${path}`, { headers: auth(PLATFORM, key) });
      expect(res.status(), `${path} must refuse a service token`).toBe(401);
    }
  });

  test("cannot attach to another org's ticket by naming its own widget", async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketA = await createTicket(request, orgA.token);
    const keyB = await widgetKeyOf(request, orgB);

    const res = await request.post(`${API_URL}/tickets/${ticketA.id}/attachments`, {
      headers: auth(PLATFORM, keyB),
      multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: PNG } },
    });
    expect(res.status()).toBe(404);

    const keyA = await widgetKeyOf(request, orgA);
    const own = await request.post(`${API_URL}/tickets/${ticketA.id}/attachments`, {
      headers: auth(PLATFORM, keyA),
      multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: PNG } },
    });
    expect(own.status()).toBe(201);
  });

  test("searches only the knowledge base of the widget's org", async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const title = unique('Resetting your password');
    const article = await request.post(`${API_URL}/knowledge/articles`, {
      headers: auth(orgA.token),
      data: { title, body: 'Choose "Forgot password" on the sign-in page and follow the emailed link.' },
    });
    expect(article.status()).toBe(201);

    const query = { query: 'how do I reset my password' };
    const inA = await request.post(`${API_URL}/knowledge/search`, {
      headers: auth(PLATFORM, await widgetKeyOf(request, orgA)),
      data: query,
    });
    const inB = await request.post(`${API_URL}/knowledge/search`, {
      headers: auth(PLATFORM, await widgetKeyOf(request, orgB)),
      data: query,
    });
    expect((await inA.json()).results.map((r) => r.title)).toContain(title);
    expect((await inB.json()).results).toEqual([]);
  });
});

test.describe('org service token with a widget key', () => {
  test('works with its own widget, and is refused on another org\'s', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const orgToken = jwt.sign({ typ: 'service', orgId: orgIdOf(orgA) }, JWT_SECRET, { expiresIn: '1h' });

    const own = await request.post(`${API_URL}/tickets`, {
      headers: auth(orgToken, await widgetKeyOf(request, orgA)),
      data: ticketPayload(),
    });
    expect(own.status()).toBe(201);

    const other = await request.post(`${API_URL}/tickets`, {
      headers: auth(orgToken, await widgetKeyOf(request, orgB)),
      data: ticketPayload(),
    });
    expect(other.status()).toBe(403);
  });

  test('a service token with neither an org nor platform scope is refused', async ({ request }) => {
    const org = await createOrg(request);
    const orgless = jwt.sign({ typ: 'service' }, JWT_SECRET, { expiresIn: '1h' });

    const res = await request.post(`${API_URL}/tickets`, {
      headers: auth(orgless, await widgetKeyOf(request, org)),
      data: ticketPayload(),
    });
    expect(res.status()).toBe(401);
  });
});
