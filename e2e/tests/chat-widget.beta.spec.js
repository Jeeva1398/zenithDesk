const { test, expect } = require('@playwright/test');
const { API_URL, createOrg, unique } = require('../helpers');
const { BETA, TARGET } = require('../test-env');

// The chat widget end to end on beta: the real widget.js from the beta chat
// server, the real bot and model, and the tickets and enquiries it files
// landing in the beta API. Only meaningful against beta (playwright.beta.config.js).
//
// A model writes the replies, so nothing here pins its wording. The test reads
// what the bot asked and answers that, the way a visitor would, and checks the
// outcome - an answer with its source, a ticket, an enquiry - through the API.

test.skip(TARGET !== 'beta', 'runs against the beta servers only');

// A made-up origin for the page the widget is embedded in. The page itself is
// served by Playwright, so no web server is needed - but the origin is real to
// the browser, and so to the chat server's allowed-sites check.
const SITE = 'http://localhost:5501';

const ARTICLE = {
  title: 'Refund policy',
  body:
    'Refunds are available within 14 days of purchase. To ask for one, email billing@example.com ' +
    'with your order number. Approved refunds reach your card within 5 business days.',
};

let org;
let widgetKey;

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

test.beforeAll(async ({ request }) => {
  org = await createOrg(request);
  const headers = auth(org.token);

  const bot = await request.patch(`${API_URL}/chat-widget`, {
    headers,
    data: {
      allowedDomains: [SITE],
      bot: { purposes: { enquiry: true, support: true, knowledge: true, status: true } },
    },
  });
  expect(bot.status()).toBe(200);
  widgetKey = (await bot.json()).publicKey;

  const article = await request.post(`${API_URL}/knowledge/articles`, { headers, data: ARTICLE });
  expect(article.status()).toBe(201);
});

async function openWidget(page, key = widgetKey) {
  await page.route(`${SITE}/`, (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: `<!doctype html><html><head><title>Widget test</title></head><body>
        <h1>Widget test</h1>
        <script src="${BETA.chat}/widget.js" data-key="${key}" defer></script>
      </body></html>`,
    }),
  );
  await page.goto(`${SITE}/`);
  await page.getByRole('button', { name: /^Open chat/ }).click();
}

// The bot's replies: its message bubbles, and the card it shows in place of
// one when a ticket has been created.
const assistantMessages = (page) =>
  page.locator('.zd-message--assistant .zd-message__bubble:not(.zd-typing), .zd-ticket-confirmation');

// Sends a message and waits for the bot to finish answering it, returning the
// text of its latest reply.
async function say(page, text, { first = false } = {}) {
  const before = await assistantMessages(page).count();
  const box = first ? page.getByRole('textbox', { name: 'Ask a question' }) : page.getByRole('textbox', { name: 'Message' });
  await box.fill(text);
  await box.press('Enter');

  await expect.poll(() => assistantMessages(page).count(), { timeout: 90_000 }).toBeGreaterThan(before);
  // Done once nothing is being typed or streamed and the box takes input again.
  await expect(page.locator('.zd-typing')).toHaveCount(0, { timeout: 90_000 });
  await expect(page.getByRole('textbox', { name: 'Message' })).toBeEnabled({ timeout: 90_000 });
  return (await assistantMessages(page).last().innerText()).trim();
}

// Answers whatever the bot asks until `done` matches its reply, as a visitor
// would: contact details when asked for them, a chip when it offers choices,
// more detail otherwise.
async function converse(page, reply, { contact, detail, done, maxTurns = 8 }) {
  const seen = [reply];
  for (let turn = 0; turn < maxTurns && !done.test(reply); turn += 1) {
    const chips = page.locator('.zd-quick-replies:not(.zd-quick-replies--questions) .zd-quick-replies__chip');
    const labels = (await chips.allInnerTexts()).map((t) => t.trim());
    let chip = null;
    if (/name and an? (email|e-mail)|get back to\?|what's your name|best email or phone/i.test(reply)) {
      reply = await say(page, contact);
    } else if (labels.includes('I still need help')) {
      // A knowledge answer that does not cover it: say so, as a visitor would.
      chip = 'I still need help';
    } else if (labels.length > 0 && /low, medium|billing, technical/i.test(reply)) {
      chip = labels[0];
    } else {
      reply = await say(page, detail);
    }
    if (chip) {
      const before = await assistantMessages(page).count();
      await chips.filter({ hasText: chip }).first().click();
      await expect.poll(() => assistantMessages(page).count(), { timeout: 90_000 }).toBeGreaterThan(before);
      await expect(page.locator('.zd-typing')).toHaveCount(0, { timeout: 90_000 });
      reply = (await assistantMessages(page).last().innerText()).trim();
      seen.push(`[chip: ${chip}]`);
    }
    seen.push(reply);
  }
  expect(reply, `the bot never got there:\n${seen.join('\n---\n')}`).toMatch(done);
  return reply;
}

test.describe('chat widget on beta', () => {
  test('answers from the knowledge base, with the article it used', async ({ page }) => {
    await openWidget(page);
    const answer = await say(page, 'How many days do I have to ask for a refund?', { first: true });

    expect(answer).toMatch(/14/);
    await expect(page.locator('.zd-message__sources').last()).toContainText(ARTICLE.title);
  });

  test('raises a ticket that reaches the team', async ({ page, request }) => {
    await openWidget(page);
    const email = `${unique('visitor')}@example.com`;

    let reply = await say(
      page,
      'I cannot log in to my account since this morning - every login attempt says "session expired" and my whole team is blocked. This is urgent.',
      { first: true },
    );
    reply = await converse(page, reply, {
      contact: `Beta Tester ${email}`,
      detail: 'It is a technical problem with logging in, and it is urgent: nobody on the team can work.',
      done: /created ticket #\d+|ticket #\d+ created/i,
    });

    const id = Number(/ticket #(\d+)/i.exec(reply)[1]);
    const ticket = await request.get(`${API_URL}/tickets/${id}`, { headers: auth(org.token) });
    expect(ticket.status()).toBe(200);
    expect(JSON.stringify(await ticket.json())).toContain(email);
  });

  test('takes down a sales enquiry for the team', async ({ page, request }) => {
    await openWidget(page);
    const email = `${unique('lead')}@example.com`;

    const reply = await say(
      page,
      'We would like a quote for 50 seats on your enterprise plan - can someone from sales contact us?',
      { first: true },
    );
    await converse(page, reply, {
      contact: `Beta Lead, ${email}, Acme Ltd`,
      detail: 'We need pricing for 50 seats and a demo for our support team.',
      done: /(team|someone) will (get back|be in touch|contact)|passed (it|this|your)/i,
    });

    const enquiries = await request.get(`${API_URL}/enquiries`, { headers: auth(org.token) });
    expect(enquiries.status()).toBe(200);
    expect(JSON.stringify(await enquiries.json())).toContain(email);
  });
});

// An org with Chat alone: its bot has no tickets to raise, so what it cannot
// answer - a problem included - is left as a message for the team.
test.describe('chat-only widget on beta', () => {
  let chatOrg;
  let chatKey;

  test.beforeAll(async ({ request }) => {
    chatOrg = await createOrg(request, { products: ['chat'] });
    const bot = await request.patch(`${API_URL}/chat-widget`, {
      headers: auth(chatOrg.token),
      data: { allowedDomains: [SITE], bot: { purposes: { enquiry: false } } },
    });
    expect(bot.status()).toBe(200);
    expect((await bot.json()).bot.purposes).toEqual({ enquiry: false, support: false, knowledge: true, status: false });
    chatKey = (await bot.json()).publicKey;
  });

  test('leaves a problem it cannot answer as a message, never a ticket', async ({ page, request }) => {
    await openWidget(page, chatKey);
    const email = `${unique('visitor')}@example.com`;

    const reply = await say(
      page,
      'My invoice export keeps failing with a timeout error every time I run it for last month.',
      { first: true },
    );
    expect(reply).not.toMatch(/ticket/i);
    await converse(page, reply, {
      contact: `Beta Visitor ${email}`,
      detail: 'It fails every time, for any month I pick.',
      done: /passed your message/i,
    });

    const messages = await request.get(`${API_URL}/enquiries?kind=message`, { headers: auth(chatOrg.token) });
    expect(messages.status()).toBe(200);
    const { enquiries } = await messages.json();
    expect(enquiries).toHaveLength(1);
    expect(enquiries[0]).toMatchObject({ email, kind: 'message', source: 'chat' });
    expect(enquiries[0].message).toMatch(/invoice export/);
  });
});
