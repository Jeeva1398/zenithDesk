const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, uniqueClientIp, unique } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

// A chat widget conversation handed from the bot to a person. The chatbot
// opens it, relays what the visitor types and polls for replies with its
// platform token; agents work it from the Live chat page.

const PLATFORM = jwt.sign({ typ: 'service', scope: 'platform' }, JWT_SECRET, { expiresIn: '1h' });

function auth(token, widgetKey) {
  const headers = { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
  if (widgetKey) headers['X-Widget-Key'] = widgetKey;
  return headers;
}

async function setBot(request, org, bot) {
  return request.patch(`${API_URL}/chat-widget`, { headers: auth(org.token), data: { bot } });
}

/** An org that hands chats to people, with its widget key. */
async function handoffOrg(request, handoff = {}) {
  const org = await createOrg(request);
  const res = await setBot(request, org, { handoff: { enabled: true, ...handoff } });
  expect(res.status()).toBe(200);
  return { org, key: (await res.json()).publicKey };
}

/** An agent's check-in, which is what makes them available to visitors. */
async function checkIn(request, token) {
  const res = await request.get(`${API_URL}/live-chats/counts`, { headers: auth(token) });
  expect(res.status()).toBe(200);
  return res.json();
}

async function openChat(request, key, data = {}) {
  return request.post(`${API_URL}/live-chats`, {
    headers: auth(PLATFORM, key),
    data: { sessionId: unique('session'), transcript: [{ role: 'user', content: 'My invoice is wrong' }], ...data },
  });
}

async function teammate(request, org) {
  const email = `${unique('mate')}@example.com`;
  await request.post(`${API_URL}/agents`, {
    headers: auth(org.token),
    data: { name: 'Team Mate', email, password: 'mate-password-1', role: 'agent' },
  });
  const login = await request.post(`${API_URL}/auth/login`, {
    headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
    data: { email, password: 'mate-password-1' },
  });
  return (await login.json()).token;
}

test.describe('handoff settings', () => {
  test('is off by default, and the chatbot cannot open a chat then', async ({ request }) => {
    const org = await createOrg(request);
    const widget = await (await request.get(`${API_URL}/chat-widget`, { headers: auth(org.token) })).json();
    expect(widget.bot.handoff).toEqual({ enabled: false, waitMinutes: 3 });
    expect(await checkIn(request, org.token)).toMatchObject({ enabled: false });

    const res = await openChat(request, widget.publicKey);
    expect(res.status()).toBe(409);
  });

  test('saves the wait, shows in the public config, and refuses bad values', async ({ request }) => {
    const { org, key } = await handoffOrg(request, { waitMinutes: 5 });
    const pub = await (await request.get(`${API_URL}/chat-widget/public/${key}`)).json();
    expect(pub.bot.handoff).toEqual({ enabled: true, waitMinutes: 5 });

    expect((await setBot(request, org, { handoff: { waitMinutes: 0 } })).status()).toBe(400);
    expect((await setBot(request, org, { handoff: { waitMinutes: 2.5 } })).status()).toBe(400);
    expect((await setBot(request, org, { handoff: { enabled: 'yes' } })).status()).toBe(400);
    expect((await setBot(request, org, { handoff: { colour: 'red' } })).status()).toBe(400);
  });
});

test.describe('live chats', () => {
  test('is refused while no agent has the portal open', async ({ request }) => {
    const { key } = await handoffOrg(request);
    const res = await openChat(request, key);
    expect(res.status()).toBe(503);
  });

  test('runs from the visitor asking to an agent ending it', async ({ request }) => {
    const { org, key } = await handoffOrg(request);
    expect(await checkIn(request, org.token)).toMatchObject({ enabled: true, waiting: 0, online: 1 });

    const sessionId = unique('session');
    const opened = await openChat(request, key, { sessionId });
    expect(opened.status()).toBe(201);
    const chat = await opened.json();
    expect(chat).toMatchObject({ status: 'waiting', agent: null, sessionId });
    expect(chat.transcript).toEqual([{ role: 'user', content: 'My invoice is wrong' }]);

    // Asking again while waiting gives back the same chat.
    const again = await (await openChat(request, key, { sessionId })).json();
    expect(again.id).toBe(chat.id);

    const visitor = await request.post(`${API_URL}/live-chats/${chat.id}/messages`, {
      headers: auth(PLATFORM, key),
      data: { sessionId, body: 'Hello, anyone there?' },
    });
    expect(visitor.status()).toBe(201);

    expect(await checkIn(request, org.token)).toMatchObject({ waiting: 1, active: 0 });
    const list = await (await request.get(`${API_URL}/live-chats`, { headers: auth(org.token) })).json();
    expect(list.open.map((c) => c.id)).toEqual([chat.id]);
    expect(list.open[0].lastMessage).toBe('Hello, anyone there?');

    // Replying to a waiting chat joins it.
    const reply = await request.post(`${API_URL}/live-chats/${chat.id}/messages`, {
      headers: auth(org.token),
      data: { body: 'Hi, I can help with that.' },
    });
    expect(reply.status()).toBe(201);
    expect((await reply.json()).status).toBe('active');

    const seen = await (
      await request.get(`${API_URL}/live-chats/${chat.id}/messages?sessionId=${sessionId}&after=0`, {
        headers: auth(PLATFORM, key),
      })
    ).json();
    expect(seen.chat).toMatchObject({ status: 'active', agent: { name: 'E2E Admin' } });
    expect(seen.messages.map((m) => [m.authorType, m.event || null])).toEqual([
      ['visitor', null],
      ['system', 'joined'],
      ['agent', null],
    ]);
    expect(seen.messages[1].authorName).toBe('E2E Admin');
    expect(seen.messages[2]).toMatchObject({ authorName: 'E2E Admin', body: 'Hi, I can help with that.' });

    // Only what is newer than the last one read.
    const later = await (
      await request.get(`${API_URL}/live-chats/${chat.id}/messages?sessionId=${sessionId}&after=${seen.messages[2].id}`, {
        headers: auth(PLATFORM, key),
      })
    ).json();
    expect(later.messages).toEqual([]);

    const closed = await request.post(`${API_URL}/live-chats/${chat.id}/close`, { headers: auth(org.token) });
    expect((await closed.json()).status).toBe('closed');

    const ended = await (
      await request.get(`${API_URL}/live-chats/${chat.id}/messages?sessionId=${sessionId}&after=${seen.messages[2].id}`, {
        headers: auth(PLATFORM, key),
      })
    ).json();
    expect(ended.chat.status).toBe('closed');
    expect(ended.messages).toMatchObject([{ authorType: 'system', event: 'ended', authorName: 'E2E Admin' }]);

    const late = await request.post(`${API_URL}/live-chats/${chat.id}/messages`, {
      headers: auth(PLATFORM, key),
      data: { sessionId, body: 'Still there?' },
    });
    expect(late.status()).toBe(409);

    const after = await (await request.get(`${API_URL}/live-chats`, { headers: auth(org.token) })).json();
    expect(after.open).toEqual([]);
    expect(after.recent.map((c) => c.id)).toEqual([chat.id]);
  });

  test('a visitor leaving before anyone joined is a missed chat', async ({ request }) => {
    const { org, key } = await handoffOrg(request);
    await checkIn(request, org.token);
    const sessionId = unique('session');
    const chat = await (await openChat(request, key, { sessionId })).json();

    const res = await request.post(`${API_URL}/live-chats/${chat.id}/close`, {
      headers: auth(PLATFORM, key),
      data: { sessionId },
    });
    expect((await res.json()).status).toBe('missed');
  });

  test('the chatbot reaches a chat only with the session it was opened for', async ({ request }) => {
    const { org, key } = await handoffOrg(request);
    await checkIn(request, org.token);
    const sessionId = unique('session');
    const chat = await (await openChat(request, key, { sessionId })).json();

    const wrong = unique('session');
    const read = await request.get(`${API_URL}/live-chats/${chat.id}/messages?sessionId=${wrong}`, {
      headers: auth(PLATFORM, key),
    });
    expect(read.status()).toBe(404);
    const write = await request.post(`${API_URL}/live-chats/${chat.id}/messages`, {
      headers: auth(PLATFORM, key),
      data: { sessionId: wrong, body: 'Hi' },
    });
    expect(write.status()).toBe(404);
    const close = await request.post(`${API_URL}/live-chats/${chat.id}/close`, {
      headers: auth(PLATFORM, key),
      data: { sessionId: wrong },
    });
    expect(close.status()).toBe(404);

    // Nor list or join chats, which are for agents.
    expect((await request.get(`${API_URL}/live-chats`, { headers: auth(PLATFORM, key) })).status()).toBe(401);
    expect(
      (await request.post(`${API_URL}/live-chats/${chat.id}/join`, { headers: auth(PLATFORM, key) })).status(),
    ).toBe(401);
  });

  test('stays inside its org', async ({ request }) => {
    const a = await handoffOrg(request);
    const b = await handoffOrg(request);
    await checkIn(request, a.org.token);
    const chat = await (await openChat(request, a.key)).json();

    const res = await request.get(`${API_URL}/live-chats/${chat.id}`, { headers: auth(b.org.token) });
    expect(res.status()).toBe(404);
    const join = await request.post(`${API_URL}/live-chats/${chat.id}/join`, { headers: auth(b.org.token) });
    expect(join.status()).toBe(404);
  });

  test('a colleague has to take a chat over before replying in it', async ({ request }) => {
    const { org, key } = await handoffOrg(request);
    await checkIn(request, org.token);
    const chat = await (await openChat(request, key)).json();
    await request.post(`${API_URL}/live-chats/${chat.id}/join`, { headers: auth(org.token) });

    const mate = await teammate(request, org);
    const blocked = await request.post(`${API_URL}/live-chats/${chat.id}/messages`, {
      headers: auth(mate),
      data: { body: 'I can take this' },
    });
    expect(blocked.status()).toBe(409);

    const taken = await request.post(`${API_URL}/live-chats/${chat.id}/join`, { headers: auth(mate) });
    expect((await taken.json()).agent.name).toBe('Team Mate');
    const reply = await request.post(`${API_URL}/live-chats/${chat.id}/messages`, {
      headers: auth(mate),
      data: { body: 'I can take this' },
    });
    expect(reply.status()).toBe(201);
  });
});
