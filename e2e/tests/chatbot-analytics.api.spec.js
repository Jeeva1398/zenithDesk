const { test, expect } = require('@playwright/test');
const jwt = require('jsonwebtoken');
const { API_URL, createOrg, uniqueClientIp, unique } = require('../helpers');
const { JWT_SECRET } = require('../test-env');

// The Chatbot tab on the dashboard: the chat server reports what happens in
// its conversations, and agents read the numbers back.

const PLATFORM = jwt.sign({ typ: 'service', scope: 'platform' }, JWT_SECRET, { expiresIn: '1h' });

function auth(token, widgetKey) {
  const headers = { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
  if (widgetKey) headers['X-Widget-Key'] = widgetKey;
  return headers;
}

async function orgWithKey(request) {
  const org = await createOrg(request);
  const widget = await (await request.get(`${API_URL}/chat-widget`, { headers: auth(org.token) })).json();
  return { org, key: widget.publicKey };
}

function report(request, key, events) {
  return request.post(`${API_URL}/analytics/chatbot/events`, { headers: auth(PLATFORM, key), data: { events } });
}

async function overview(request, org, days = 30) {
  const res = await request.get(`${API_URL}/analytics/chatbot?days=${days}`, { headers: auth(org.token) });
  expect(res.status()).toBe(200);
  return res.json();
}

test.describe('chatbot analytics', () => {
  test('a new org reads all zeros, with a full daily trend', async ({ request }) => {
    const { org } = await orgWithKey(request);
    const data = await overview(request, org, 7);
    expect(data.totals).toEqual({
      conversations: 0,
      handledByBot: 0,
      handledByBotRate: null,
      tickets: 0,
      enquiries: 0,
      handoffs: 0,
    });
    expect(data.ratings).toEqual({ up: 0, down: 0, satisfaction: null });
    expect(data.liveChats).toEqual({ total: 0, answered: 0, missed: 0, avgWaitSeconds: null });
    expect(data.trend).toHaveLength(7);
    expect(data.trend.every((d) => d.conversations === 0)).toBe(true);
    expect(data.knowledgeGaps).toEqual([]);
  });

  test('counts what the chatbot reports', async ({ request }) => {
    const { org, key } = await orgWithKey(request);
    const [a, b, c, d] = [1, 2, 3, 4].map(() => unique('session'));

    const res = await report(request, key, [
      // a: answered from the knowledge base, and it helped.
      { sessionId: a, type: 'conversation' },
      { sessionId: a, type: 'kb_answered', detail: 'How do I export to CSV?' },
      { sessionId: a, type: 'kb_helpful' },
      { sessionId: a, type: 'rating_up', detail: 'm2' },
      // b: answered, did not help, became a ticket; the rating was changed.
      { sessionId: b, type: 'conversation' },
      { sessionId: b, type: 'kb_answered', detail: 'Why was I charged twice?' },
      { sessionId: b, type: 'kb_not_helpful' },
      { sessionId: b, type: 'ticket' },
      { sessionId: b, type: 'rating_up', detail: 'm5' },
      { sessionId: b, type: 'rating_down', detail: 'm5' },
      // c: nothing in the knowledge base, asked for a person.
      { sessionId: c, type: 'conversation' },
      { sessionId: c, type: 'kb_no_answer', detail: 'why was i charged twice?' },
      { sessionId: c, type: 'handoff' },
      // d: left an enquiry; a rating taken back.
      { sessionId: d, type: 'conversation' },
      { sessionId: d, type: 'enquiry' },
      { sessionId: d, type: 'rating_down', detail: 'm9' },
      { sessionId: d, type: 'rating_cleared', detail: 'm9' },
    ]);
    expect(res.status()).toBe(201);
    expect(await res.json()).toEqual({ recorded: 17 });

    const data = await overview(request, org);
    expect(data.totals).toEqual({
      conversations: 4,
      handledByBot: 2,
      handledByBotRate: 0.5,
      tickets: 1,
      enquiries: 1,
      handoffs: 1,
    });
    expect(data.knowledge).toEqual({ answered: 2, helpful: 1, notHelpful: 1, noAnswer: 1, helpfulRate: 0.5 });
    expect(data.ratings).toEqual({ up: 1, down: 1, satisfaction: 0.5 });

    const today = data.trend[data.trend.length - 1];
    expect(today).toMatchObject({ conversations: 4, escalated: 2 });

    // The same question twice, case aside; the one that helped is not a gap.
    expect(data.knowledgeGaps).toHaveLength(1);
    expect(data.knowledgeGaps[0]).toMatchObject({ count: 2, unanswered: 1 });
    expect(data.knowledgeGaps[0].question.toLowerCase()).toBe('why was i charged twice?');
  });

  test('counts live chats from its own records', async ({ request }) => {
    const { org, key } = await orgWithKey(request);
    await request.patch(`${API_URL}/chat-widget`, {
      headers: auth(org.token),
      data: { bot: { handoff: { enabled: true } } },
    });
    await request.get(`${API_URL}/live-chats/counts`, { headers: auth(org.token) });

    const open = (sessionId) =>
      request.post(`${API_URL}/live-chats`, { headers: auth(PLATFORM, key), data: { sessionId } });
    const answered = await (await open(unique('session'))).json();
    await request.post(`${API_URL}/live-chats/${answered.id}/join`, { headers: auth(org.token) });
    const missedSession = unique('session');
    const missed = await (await open(missedSession)).json();
    await request.post(`${API_URL}/live-chats/${missed.id}/close`, {
      headers: auth(PLATFORM, key),
      data: { sessionId: missedSession },
    });

    const data = await overview(request, org);
    expect(data.liveChats).toMatchObject({ total: 2, answered: 1, missed: 1 });
    expect(data.liveChats.avgWaitSeconds).toBeGreaterThanOrEqual(0);
  });

  test('stays inside its org', async ({ request }) => {
    const a = await orgWithKey(request);
    const b = await orgWithKey(request);
    await report(request, a.key, [{ sessionId: unique('session'), type: 'conversation' }]);
    expect((await overview(request, a.org)).totals.conversations).toBe(1);
    expect((await overview(request, b.org)).totals.conversations).toBe(0);
  });

  test('only the chatbot reports, and only known events', async ({ request }) => {
    const { org, key } = await orgWithKey(request);
    const asAgent = await request.post(`${API_URL}/analytics/chatbot/events`, {
      headers: auth(org.token),
      data: { events: [{ sessionId: 's', type: 'conversation' }] },
    });
    expect(asAgent.status()).toBe(403);

    expect((await report(request, key, [])).status()).toBe(400);
    expect((await report(request, key, [{ sessionId: 's', type: 'made_up' }])).status()).toBe(400);
    expect((await report(request, key, [{ type: 'conversation' }])).status()).toBe(400);

    // Nor can the chatbot read the numbers.
    const read = await request.get(`${API_URL}/analytics/chatbot`, { headers: auth(PLATFORM, key) });
    expect(read.status()).toBe(401);
  });
});
