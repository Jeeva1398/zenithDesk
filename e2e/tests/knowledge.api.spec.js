const { test, expect } = require('@playwright/test');
const path = require('path');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, uniqueClientIp, unique, PASSWORD } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

const kbSearch = require(path.resolve(__dirname, '..', '..', 'server', 'src', 'services', 'kbSearch'));

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
}

function serviceToken(org) {
  const { orgId } = jwt.verify(org.token, JWT_SECRET);
  return jwt.sign({ typ: 'service', orgId }, JWT_SECRET, { expiresIn: '1h' });
}

const ARTICLES = [
  {
    title: 'Resetting your password',
    body: 'Go to the sign-in page and choose "Forgot password". We email a reset link that works for 30 minutes.\n\nIf the email does not arrive, check your spam folder.',
  },
  {
    title: 'Refunds and double charges',
    body: 'If you were charged twice for the same invoice, the duplicate charge is refunded automatically within 5 business days.',
  },
  {
    title: 'Exporting reports to CSV',
    body: 'Open Reports, pick a date range and press Export. Large exports are emailed to you as a download link.',
  },
];

async function addArticles(request, token, articles = ARTICLES) {
  for (const article of articles) {
    const res = await request.post(`${API_URL}/knowledge/articles`, { headers: auth(token), data: article });
    expect(res.status()).toBe(201);
  }
}

async function search(request, token, query) {
  const res = await request.post(`${API_URL}/knowledge/search`, { headers: auth(token), data: { query } });
  expect(res.status()).toBe(200);
  return (await res.json()).results;
}

test.describe('knowledge base', () => {
  test('an admin can add, edit, unpublish and delete articles', async ({ request }) => {
    const org = await createOrg(request);

    const created = await request.post(`${API_URL}/knowledge/articles`, {
      headers: auth(org.token),
      data: { title: '  Shipping times  ', body: 'Orders ship within two days.' },
    });
    expect(created.status()).toBe(201);
    const article = await created.json();
    expect(article.title).toBe('Shipping times');
    expect(article.is_published).toBe(true);

    const edited = await request.patch(`${API_URL}/knowledge/articles/${article.id}`, {
      headers: auth(org.token),
      data: { body: 'Orders ship within one day.', isPublished: false },
    });
    expect(edited.status()).toBe(200);
    expect((await edited.json()).is_published).toBe(false);

    const list = await (await request.get(`${API_URL}/knowledge/articles`, { headers: auth(org.token) })).json();
    expect(list.articles.map((a) => a.id)).toEqual([article.id]);

    const removed = await request.delete(`${API_URL}/knowledge/articles/${article.id}`, { headers: auth(org.token) });
    expect(removed.status()).toBe(204);
  });

  test('blank or oversized articles are refused', async ({ request }) => {
    const org = await createOrg(request);
    for (const data of [
      { title: '', body: 'x' },
      { title: 'x', body: '   ' },
      { title: 'x'.repeat(201), body: 'x' },
      { title: 'x', body: 'x'.repeat(50_001) },
      { title: 'x', body: 'x', isPublished: 'yes' },
    ]) {
      const res = await request.post(`${API_URL}/knowledge/articles`, { headers: auth(org.token), data });
      expect(res.status(), JSON.stringify(data).slice(0, 80)).toBe(400);
    }
  });

  test('search puts the article that answers the question first', async ({ request }) => {
    const org = await createOrg(request);
    await addArticles(request, org.token);

    expect((await search(request, org.token, 'I got charged twice on my invoice'))[0].title).toBe(
      'Refunds and double charges',
    );
    expect((await search(request, org.token, 'how do I reset my password?'))[0].title).toBe(
      'Resetting your password',
    );
    expect((await search(request, org.token, 'exporting a report as csv'))[0].title).toBe('Exporting reports to CSV');
    expect(await search(request, org.token, 'the weather in Lisbon')).toEqual([]);
  });

  test('search follows edits and ignores drafts', async ({ request }) => {
    const org = await createOrg(request);
    await addArticles(request, org.token);
    const [{ articleId }] = await search(request, org.token, 'charged twice');

    await request.patch(`${API_URL}/knowledge/articles/${articleId}`, {
      headers: auth(org.token),
      data: { isPublished: false },
    });
    const after = await search(request, org.token, 'charged twice');
    expect(after.some((r) => r.articleId === articleId)).toBe(false);
  });

  test("an org never finds another org's articles", async ({ request }) => {
    const org = await createOrg(request);
    const other = await createOrg(request);
    await addArticles(request, org.token);

    expect(await search(request, other.token, 'charged twice on my invoice')).toEqual([]);
    const res = await request.patch(`${API_URL}/knowledge/articles/1`, {
      headers: auth(other.token),
      data: { title: 'hijacked' },
    });
    expect([404]).toContain(res.status());
  });

  test('the chatbot service token can search, and nothing else', async ({ request }) => {
    const org = await createOrg(request);
    await addArticles(request, org.token);
    const service = serviceToken(org);

    expect((await search(request, service, 'reset my password'))[0].title).toBe('Resetting your password');

    const list = await request.get(`${API_URL}/knowledge/articles`, { headers: auth(service) });
    expect(list.status()).toBe(401);
    const write = await request.post(`${API_URL}/knowledge/articles`, {
      headers: auth(service),
      data: { title: 'x', body: 'y' },
    });
    expect(write.status()).toBe(401);
  });

  test('a non-admin agent can read but not write', async ({ request }) => {
    const org = await createOrg(request);
    const email = `${unique('plain')}@example.com`;
    await request.post(`${API_URL}/agents`, {
      headers: auth(org.token),
      data: { name: 'Plain Agent', email, password: PASSWORD, role: 'agent' },
    });
    const { token } = await (
      await request.post(`${API_URL}/auth/login`, {
        headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
        data: { email, password: PASSWORD },
      })
    ).json();

    expect((await request.get(`${API_URL}/knowledge/articles`, { headers: auth(token) })).status()).toBe(200);
    const write = await request.post(`${API_URL}/knowledge/articles`, {
      headers: auth(token),
      data: { title: 'x', body: 'y' },
    });
    expect(write.status()).toBe(403);
  });
});

test.describe('knowledge ranking', () => {
  test('a word found in every article still scores, unlike InnoDB FULLTEXT', () => {
    const index = kbSearch.buildIndex([
      { id: 1, title: 'Account basics', body: 'Your account holds your settings.' },
      { id: 2, title: 'Account deletion', body: 'Deleting your account removes it for good.' },
    ]);
    const results = kbSearch.search(index, 'delete my account');
    expect(results[0].articleId).toBe(2);
    expect(results.every((r) => r.score > 0)).toBe(true);
  });

  test('long articles are cut into passages, each carrying its title', () => {
    const body = Array.from({ length: 6 }, (_, i) => `Paragraph ${i} ${'word '.repeat(60)}`).join('\n\n');
    const passages = kbSearch.toPassages({ id: 7, title: 'Big guide', body });
    expect(passages.length).toBeGreaterThan(1);
    expect(passages.every((p) => p.title === 'Big guide' && p.text.length <= 1200)).toBe(true);
  });
});
