const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique, PASSWORD } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
}

function serviceToken(orgId) {
  return jwt.sign({ typ: 'service', orgId }, JWT_SECRET, { expiresIn: '1h' });
}

function orgIdOf(org) {
  return jwt.verify(org.token, JWT_SECRET).orgId;
}

async function settings(request, token) {
  const res = await request.get(`${API_URL}/chat-widget`, { headers: auth(token) });
  expect(res.status()).toBe(200);
  return res.json();
}

function patch(request, token, data) {
  return request.patch(`${API_URL}/chat-widget`, { headers: auth(token), data });
}

// The smallest files that pass each signature check.
const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(32, 1),
]);
const PDF = Buffer.from('%PDF-1.4\n% e2e fixture\n%%EOF\n');
const HTML = Buffer.from('<html><script>alert(1)</script></html>');

function upload(request, token, ticketId, { name, mimeType, buffer }) {
  return request.post(`${API_URL}/tickets/${ticketId}/attachments`, {
    headers: auth(token),
    multipart: { file: { name, mimeType, buffer } },
  });
}

test.describe('chat widget settings', () => {
  test('a new org starts with a key and the default look', async ({ request }) => {
    const org = await createOrg(request);
    const result = await settings(request, org.token);

    expect(result.publicKey).toMatch(/^zdw_[0-9a-f]{32}$/);
    expect(result.allowedDomains).toEqual([]);
    expect(result.theme.primaryColor).toMatch(/^#[0-9a-f]{6}$/);
    expect(result.tools.attachments.enabled).toBe(true);
  });

  test('an admin can restyle the widget, and unchanged fields keep their values', async ({
    request,
  }) => {
    const org = await createOrg(request);
    const before = await settings(request, org.token);

    const res = await patch(request, org.token, {
      theme: { primaryColor: '#E11D48', title: 'Acme Help', position: 'left' },
    });
    expect(res.status()).toBe(200);
    const updated = await res.json();

    expect(updated.theme.primaryColor).toBe('#e11d48');
    expect(updated.theme.title).toBe('Acme Help');
    expect(updated.theme.position).toBe('left');
    expect(updated.theme.placeholder).toBe(before.theme.placeholder);
  });

  test('values that would land unchecked on a customer site are refused', async ({ request }) => {
    const org = await createOrg(request);

    const bad = [
      { theme: { primaryColor: 'red; background:url(x)' } },
      { theme: { logoUrl: 'javascript:alert(1)' } },
      { theme: { logoUrl: 'http://example.com/logo.png' } },
      { theme: { cornerRadius: 99 } },
      { theme: { fontFamily: 'Comic Sans' } },
      { theme: { title: '' } },
      { theme: { somethingElse: 'x' } },
      { tools: { attachments: { types: ['svg'] } } },
      { tools: { attachments: { maxMb: 50 } } },
      { allowedDomains: ['*.example.com'] },
      { allowedDomains: ['ftp://example.com'] },
    ];

    for (const data of bad) {
      const res = await patch(request, org.token, data);
      expect(res.status(), JSON.stringify(data)).toBe(400);
    }
  });

  test('allowed sites are stored as bare origins', async ({ request }) => {
    const org = await createOrg(request);

    const res = await patch(request, org.token, {
      allowedDomains: ['example.com', 'https://help.example.com/some/page', 'http://localhost:5173'],
    });
    expect(res.status()).toBe(200);
    expect((await res.json()).allowedDomains).toEqual([
      'https://example.com',
      'https://help.example.com',
      'http://localhost:5173',
    ]);
  });

  test('a non-admin agent can read the settings but not change them', async ({ request }) => {
    const org = await createOrg(request);
    const email = `${unique('plain')}@example.com`;
    await request.post(`${API_URL}/agents`, {
      headers: auth(org.token),
      data: { name: 'Plain Agent', email, password: PASSWORD, role: 'agent' },
    });
    const login = await request.post(`${API_URL}/auth/login`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      data: { email, password: PASSWORD },
    });
    const { token } = await login.json();

    await settings(request, token);
    expect((await patch(request, token, { theme: { title: 'Nope' } })).status()).toBe(403);
    expect(
      (await request.post(`${API_URL}/chat-widget/regenerate-key`, { headers: auth(token) })).status(),
    ).toBe(403);
  });

  test('the public lookup finds the org by key, and a regenerated key retires the old one', async ({
    request,
  }) => {
    const org = await createOrg(request);
    const { publicKey } = await settings(request, org.token);

    const lookup = await request.get(`${API_URL}/chat-widget/public/${publicKey}`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
    });
    expect(lookup.status()).toBe(200);
    const config = await lookup.json();
    expect(config.orgId).toBe(orgIdOf(org));
    expect(config.publicKey).toBeUndefined();

    const regen = await request.post(`${API_URL}/chat-widget/regenerate-key`, {
      headers: auth(org.token),
    });
    const fresh = (await regen.json()).publicKey;
    expect(fresh).not.toBe(publicKey);

    const stale = await request.get(`${API_URL}/chat-widget/public/${publicKey}`, {
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
    });
    expect(stale.status()).toBe(404);
  });

  test('an unknown or malformed key is a 404', async ({ request }) => {
    for (const key of ['zdw_00000000000000000000000000000000', 'nonsense', "1' OR '1'='1"]) {
      const res = await request.get(`${API_URL}/chat-widget/public/${encodeURIComponent(key)}`, {
        headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
      });
      expect(res.status(), key).toBe(404);
    }
  });
});

test.describe('ticket attachments', () => {
  test('an uploaded file shows on the ticket and downloads byte for byte', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const res = await upload(request, org.token, ticket.id, {
      name: 'screenshot.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    expect(res.status()).toBe(201);
    const attachment = await res.json();
    expect(attachment.filename).toBe('screenshot.png');
    expect(attachment.mime_type).toBe('image/png');

    const detail = await (
      await request.get(`${API_URL}/tickets/${ticket.id}`, { headers: auth(org.token) })
    ).json();
    expect(detail.attachments.map((a) => a.id)).toEqual([attachment.id]);

    const download = await request.get(
      `${API_URL}/tickets/${ticket.id}/attachments/${attachment.id}`,
      { headers: auth(org.token) },
    );
    expect(download.status()).toBe(200);
    expect(download.headers()['content-disposition']).toContain('attachment');
    expect(Buffer.compare(await download.body(), PNG)).toBe(0);
  });

  test('the type comes from the bytes, not the name or the declared type', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const res = await upload(request, org.token, ticket.id, {
      name: 'innocent.png',
      mimeType: 'image/png',
      buffer: HTML,
    });
    expect(res.status()).toBe(415);
  });

  test('a service token is held to the org widget settings', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const service = serviceToken(orgIdOf(org));

    // PDF is on by default...
    expect(
      (await upload(request, service, ticket.id, { name: 'a.pdf', mimeType: 'application/pdf', buffer: PDF })).status(),
    ).toBe(201);

    // ...until the admin narrows the list,
    await patch(request, org.token, { tools: { attachments: { types: ['png'] } } });
    expect(
      (await upload(request, service, ticket.id, { name: 'b.pdf', mimeType: 'application/pdf', buffer: PDF })).status(),
    ).toBe(415);

    // ...or turns attachments off altogether.
    await patch(request, org.token, { tools: { attachments: { enabled: false } } });
    expect(
      (await upload(request, service, ticket.id, { name: 'c.png', mimeType: 'image/png', buffer: PNG })).status(),
    ).toBe(403);
  });

  test('a service token still cannot download anything', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const attachment = await (
      await upload(request, org.token, ticket.id, { name: 'x.png', mimeType: 'image/png', buffer: PNG })
    ).json();

    const res = await request.get(`${API_URL}/tickets/${ticket.id}/attachments/${attachment.id}`, {
      headers: auth(serviceToken(orgIdOf(org))),
    });
    expect(res.status()).toBe(401);
  });

  test('another org can neither download nor attach', async ({ request }) => {
    const org = await createOrg(request);
    const other = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const attachment = await (
      await upload(request, org.token, ticket.id, { name: 'x.png', mimeType: 'image/png', buffer: PNG })
    ).json();

    const download = await request.get(
      `${API_URL}/tickets/${ticket.id}/attachments/${attachment.id}`,
      { headers: auth(other.token) },
    );
    expect(download.status()).toBe(404);

    const attach = await upload(request, other.token, ticket.id, {
      name: 'y.png',
      mimeType: 'image/png',
      buffer: PNG,
    });
    expect(attach.status()).toBe(404);
  });
});

test.describe('chat widget home screen', () => {
  test('has defaults an older org reads back without saving anything', async ({ request }) => {
    const org = await createOrg(request);
    const { theme } = await settings(request, org.token);
    expect(theme.homeTitle).toBe('How can we help?');
    expect(theme.topics).toEqual([]);
    expect(theme.showPoweredBy).toBe(true);
    expect(theme.privacyNotice).toContain('passwords');
  });

  test('saves topics, the notice and the badge, and serves them publicly', async ({ request }) => {
    const org = await createOrg(request);
    const res = await patch(request, org.token, {
      theme: {
        homeTitle: 'What would you like to know?',
        topics: [{ title: '  Shipping times ', subtitle: 'Where is my order' }, { title: 'Returns' }],
        privacyNotice: '',
        showPoweredBy: false,
      },
    });
    expect(res.status()).toBe(200);
    const saved = await res.json();
    expect(saved.theme.topics).toEqual([
      { title: 'Shipping times', subtitle: 'Where is my order' },
      { title: 'Returns', subtitle: '' },
    ]);

    const pub = await (await request.get(`${API_URL}/chat-widget/public/${saved.publicKey}`)).json();
    expect(pub.theme.homeTitle).toBe('What would you like to know?');
    expect(pub.theme.privacyNotice).toBe('');
    expect(pub.theme.showPoweredBy).toBe(false);
  });

  test('refuses bad topics and a non-boolean badge', async ({ request }) => {
    const org = await createOrg(request);
    const seven = Array.from({ length: 7 }, (_, i) => ({ title: `Topic ${i}` }));
    expect((await patch(request, org.token, { theme: { topics: seven } })).status()).toBe(400);
    expect((await patch(request, org.token, { theme: { topics: [{ title: '' }] } })).status()).toBe(400);
    expect((await patch(request, org.token, { theme: { topics: [{ title: 'x'.repeat(41) }] } })).status()).toBe(400);
    expect((await patch(request, org.token, { theme: { topics: 'Shipping' } })).status()).toBe(400);
    expect((await patch(request, org.token, { theme: { showPoweredBy: 'yes' } })).status()).toBe(400);
    expect((await patch(request, org.token, { theme: { homeTitle: ' ' } })).status()).toBe(400);
  });
});
