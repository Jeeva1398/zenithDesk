const fs = require('fs');
const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, uniqueClientIp, unique } = require('../helpers');
const { JWT_SECRET, SERVER_LOG } = require('../test-env');

// The bot's purpose setting and the enquiries it takes down. The chatbot files
// enquiries with its platform token; agents work them from their own page.

const PLATFORM = jwt.sign({ typ: 'service', scope: 'platform' }, JWT_SECRET, { expiresIn: '1h' });

function auth(token, widgetKey) {
  const headers = { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
  if (widgetKey) headers['X-Widget-Key'] = widgetKey;
  return headers;
}

async function widgetOf(request, org) {
  const res = await request.get(`${API_URL}/chat-widget`, { headers: auth(org.token) });
  expect(res.status()).toBe(200);
  return res.json();
}

async function setBot(request, org, bot) {
  return request.patch(`${API_URL}/chat-widget`, { headers: auth(org.token), data: { bot } });
}

/** An org whose bot takes enquiries, with its widget key. */
async function enquiryOrg(request, bot = {}) {
  const org = await createOrg(request);
  const res = await setBot(request, org, { purposes: { enquiry: true }, ...bot });
  expect(res.status()).toBe(200);
  return { org, key: (await res.json()).publicKey };
}

function enquiry(overrides = {}) {
  return {
    name: 'Asha Rao',
    email: `${unique('lead')}@example.com`,
    phone: '+91 98765 43210',
    company: 'Rao Traders',
    message: 'Do you offer a plan for a team of 20?',
    ...overrides,
  };
}

test.describe('bot purpose settings', () => {
  test('defaults to what the bot did before: support, knowledge and status, no enquiries', async ({ request }) => {
    const org = await createOrg(request);
    const { bot } = await widgetOf(request, org);
    expect(bot.purposes).toEqual({ enquiry: false, support: true, knowledge: true, status: true });
    expect(bot.enquiryAlertEmail).toBe('');
  });

  test('saves purposes and wording, and keeps the alert address out of the public config', async ({ request }) => {
    const org = await createOrg(request);
    const res = await setBot(request, org, {
      purposes: { enquiry: true, support: false, status: false },
      companyDescription: '  We sell accounting software.  ',
      outOfScopeMessage: 'For support, email help@example.com',
      enquiryAlertEmail: 'Sales@Example.com',
    });
    expect(res.status()).toBe(200);
    const saved = await res.json();
    expect(saved.bot.purposes).toEqual({ enquiry: true, support: false, knowledge: true, status: false });
    expect(saved.bot.companyDescription).toBe('We sell accounting software.');
    expect(saved.bot.enquiryAlertEmail).toBe('sales@example.com');

    const pub = await request.get(`${API_URL}/chat-widget/public/${saved.publicKey}`);
    const body = await pub.json();
    expect(body.bot.purposes.enquiry).toBe(true);
    expect(body.bot.outOfScopeMessage).toBe('For support, email help@example.com');
    expect(body.bot).not.toHaveProperty('enquiryAlertEmail');
    expect(JSON.stringify(body)).not.toContain('sales@example.com');
  });

  test('refuses a bot with nothing to do, unknown fields, and a bad alert address', async ({ request }) => {
    const org = await createOrg(request);
    const none = await setBot(request, org, {
      purposes: { enquiry: false, support: false, knowledge: false, status: false },
    });
    expect(none.status()).toBe(400);

    expect((await setBot(request, org, { purposes: { sales: true } })).status()).toBe(400);
    expect((await setBot(request, org, { mood: 'cheerful' })).status()).toBe(400);
    expect((await setBot(request, org, { enquiryAlertEmail: 'not-an-email' })).status()).toBe(400);
    expect((await setBot(request, org, { outOfScopeMessage: 'x'.repeat(301) })).status()).toBe(400);
  });

  test('only an admin can change it', async ({ request }) => {
    const org = await createOrg(request);
    const agentEmail = `${unique('agent')}@example.com`;
    await request.post(`${API_URL}/agents`, {
      headers: auth(org.token),
      data: { name: 'Agent', email: agentEmail, password: 'agent-password-1', role: 'agent' },
    });
    const login = await request.post(`${API_URL}/auth/login`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: { email: agentEmail, password: 'agent-password-1' },
    });
    const { token } = await login.json();
    const res = await request.patch(`${API_URL}/chat-widget`, {
      headers: auth(token),
      data: { bot: { purposes: { enquiry: true } } },
    });
    expect(res.status()).toBe(403);
  });
});

test.describe('enquiries', () => {
  test('the chatbot files one into the org of the widget it names', async ({ request }) => {
    const a = await enquiryOrg(request);
    const b = await enquiryOrg(request);

    const res = await request.post(`${API_URL}/enquiries`, { headers: auth(PLATFORM, a.key), data: enquiry() });
    expect(res.status()).toBe(201);
    const created = await res.json();
    expect(created).toMatchObject({ name: 'Asha Rao', status: 'new', source: 'chat', company: 'Rao Traders' });

    const listA = await (await request.get(`${API_URL}/enquiries`, { headers: auth(a.org.token) })).json();
    const listB = await (await request.get(`${API_URL}/enquiries`, { headers: auth(b.org.token) })).json();
    expect(listA.enquiries.map((e) => e.id)).toContain(created.id);
    expect(listB.enquiries.map((e) => e.id)).not.toContain(created.id);

    const crossRead = await request.get(`${API_URL}/enquiries/${created.id}`, { headers: auth(b.org.token) });
    expect(crossRead.status()).toBe(404);
  });

  test('needs a name and at least one of email or phone', async ({ request }) => {
    const { key } = await enquiryOrg(request);
    const post = (data) => request.post(`${API_URL}/enquiries`, { headers: auth(PLATFORM, key), data });

    expect((await post(enquiry({ name: '' }))).status()).toBe(400);
    expect((await post(enquiry({ email: '', phone: '' }))).status()).toBe(400);
    expect((await post(enquiry({ email: 'nope', phone: undefined }))).status()).toBe(400);
    expect((await post(enquiry({ email: undefined, phone: '12' }))).status()).toBe(400);
    expect((await post(enquiry({ message: '' }))).status()).toBe(400);

    expect((await post(enquiry({ phone: undefined, company: undefined }))).status()).toBe(201);
    expect((await post(enquiry({ email: undefined }))).status()).toBe(201);
  });

  test('is refused when the org has enquiries turned off', async ({ request }) => {
    const org = await createOrg(request);
    const { publicKey } = await widgetOf(request, org);
    const res = await request.post(`${API_URL}/enquiries`, { headers: auth(PLATFORM, publicKey), data: enquiry() });
    expect(res.status()).toBe(409);
  });

  test('the service token cannot read enquiries back', async ({ request }) => {
    const { key } = await enquiryOrg(request);
    const res = await request.get(`${API_URL}/enquiries`, { headers: auth(PLATFORM, key) });
    expect(res.status()).toBe(401);
  });

  test('agents filter, search, and move them through their statuses', async ({ request }) => {
    const { org, key } = await enquiryOrg(request);
    const post = (data) => request.post(`${API_URL}/enquiries`, { headers: auth(PLATFORM, key), data });
    const first = await (await post(enquiry({ company: 'Northwind' }))).json();
    await post(enquiry({ company: 'Contoso' }));

    const search = await (await request.get(`${API_URL}/enquiries?q=north`, { headers: auth(org.token) })).json();
    expect(search.enquiries.map((e) => e.id)).toEqual([first.id]);

    const patched = await request.patch(`${API_URL}/enquiries/${first.id}`, {
      headers: auth(org.token),
      data: { status: 'contacted', notes: 'Called, sending a quote.' },
    });
    expect(patched.status()).toBe(200);
    expect(await patched.json()).toMatchObject({ status: 'contacted', notes: 'Called, sending a quote.' });

    const contacted = await (await request.get(`${API_URL}/enquiries?status=contacted`, { headers: auth(org.token) })).json();
    expect(contacted.enquiries.map((e) => e.id)).toEqual([first.id]);
    expect(contacted.counts).toEqual({ new: 1, contacted: 1, closed: 0 });

    const bad = await request.patch(`${API_URL}/enquiries/${first.id}`, {
      headers: auth(org.token),
      data: { status: 'won' },
    });
    expect(bad.status()).toBe(400);
  });

  test('emails the org alert address, and only that address', async ({ request }) => {
    const alertTo = `${unique('sales')}@example.com`;
    const { key } = await enquiryOrg(request, { enquiryAlertEmail: alertTo });
    const lead = enquiry({ company: unique('Company') });
    expect((await request.post(`${API_URL}/enquiries`, { headers: auth(PLATFORM, key), data: lead })).status()).toBe(201);

    const deadline = Date.now() + 5000;
    let log = '';
    while (Date.now() < deadline) {
      log = fs.existsSync(SERVER_LOG) ? fs.readFileSync(SERVER_LOG, 'utf8') : '';
      if (log.includes(lead.company)) break;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(log).toContain(`logging enquiry alert instead of emailing ${alertTo}`);
    expect(log).not.toContain(`logging enquiry alert instead of emailing ${lead.email}`);
  });
});
