const { test, expect } = require('@playwright/test');
const path = require('path');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique, PASSWORD } = require('../helpers');

const slaService = require(
  path.resolve(__dirname, '..', '..', 'server', 'src', 'services', 'sla.service'),
);

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
}

async function policies(request, token) {
  const res = await request.get(`${API_URL}/sla/policies`, { headers: auth(token) });
  return (await res.json()).policies;
}

test.describe('SLA policies', () => {
  test('a new org starts with one policy per priority, most urgent first', async ({ request }) => {
    const org = await createOrg(request);
    const list = await policies(request, org.token);

    expect(list.map((p) => p.priority)).toEqual(['urgent', 'high', 'medium', 'low']);
    for (const policy of list) {
      expect(policy.first_response_minutes).toBeGreaterThan(0);
      expect(policy.resolution_minutes).toBeGreaterThanOrEqual(policy.first_response_minutes);
    }
  });

  test('an admin can retune a target', async ({ request }) => {
    const org = await createOrg(request);
    const [urgent] = await policies(request, org.token);

    const res = await request.patch(`${API_URL}/sla/policies/${urgent.id}`, {
      headers: auth(org.token),
      data: { firstResponseMinutes: 15, resolutionMinutes: 120 },
    });

    expect(res.status()).toBe(200);
    const updated = await res.json();
    expect(updated.first_response_minutes).toBe(15);
    expect(updated.resolution_minutes).toBe(120);
  });

  test('a resolution target shorter than the first-reply target is refused', async ({
    request,
  }) => {
    const org = await createOrg(request);
    const [urgent] = await policies(request, org.token);

    const res = await request.patch(`${API_URL}/sla/policies/${urgent.id}`, {
      headers: auth(org.token),
      data: { firstResponseMinutes: 120, resolutionMinutes: 60 },
    });

    expect(res.status()).toBe(400);
    expect((await res.json()).error).toContain('cannot be shorter');
  });

  test('nonsense minute values are refused', async ({ request }) => {
    const org = await createOrg(request);
    const [urgent] = await policies(request, org.token);

    for (const value of [0, -5, 1.5, 'soon', 60 * 24 * 400]) {
      const res = await request.patch(`${API_URL}/sla/policies/${urgent.id}`, {
        headers: auth(org.token),
        data: { firstResponseMinutes: value },
      });
      expect(res.status(), `value ${value} should be refused`).toBe(400);
    }
  });

  test('a non-admin agent can read the targets but not change them', async ({ request }) => {
    const org = await createOrg(request);
    const email = `${unique('plain')}@example.com`;
    await request.post(`${API_URL}/agents`, {
      headers: auth(org.token),
      data: { name: 'Plain Agent', email, password: PASSWORD, role: 'agent' },
    });
    const login = await request.post(`${API_URL}/auth/login`, {
      data: { email, password: PASSWORD },
      headers: { 'X-ZenithDesk-Client-IP': uniqueClientIp() },
    });
    const { token } = await login.json();

    const read = await request.get(`${API_URL}/sla/policies`, { headers: auth(token) });
    expect(read.status()).toBe(200);

    const [urgent] = await policies(request, org.token);
    const write = await request.patch(`${API_URL}/sla/policies/${urgent.id}`, {
      headers: auth(token),
      data: { firstResponseMinutes: 5 },
    });
    expect(write.status()).toBe(403);
  });

  test("another org's policy is not reachable", async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const [urgentA] = await policies(request, orgA.token);

    const res = await request.patch(`${API_URL}/sla/policies/${urgentA.id}`, {
      headers: auth(orgB.token),
      data: { firstResponseMinutes: 5 },
    });
    expect(res.status()).toBe(404);
  });
});

test.describe('SLA on tickets', () => {
  test('a fresh ticket is on track, in the list and on the detail', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const detail = await request.get(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
    });
    const body = await detail.json();
    expect(body.sla.state).toBe('pending');
    expect(body.sla.firstResponse.achievedAt).toBeNull();

    const list = await request.get(`${API_URL}/tickets`, { headers: auth(org.token) });
    const row = (await list.json()).tickets.find((t) => t.id === ticket.id);
    expect(row.sla.state).toBe('pending');
  });

  test('an agent reply meets the first-response target', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    await request.post(`${API_URL}/tickets/${ticket.id}/comments`, {
      headers: auth(org.token),
      data: { body: 'On it.' },
    });

    const detail = await request.get(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
    });
    const { sla } = await detail.json();
    expect(sla.firstResponse.state).toBe('met');
    expect(sla.firstResponse.achievedAt).not.toBeNull();
  });

  test('the due date follows the policy, so retuning it re-measures old tickets', async ({
    request,
  }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token, { priority: 'urgent' });
    const [urgent] = await policies(request, org.token);

    await request.patch(`${API_URL}/sla/policies/${urgent.id}`, {
      headers: auth(org.token),
      data: { firstResponseMinutes: 90, resolutionMinutes: 180 },
    });

    // Nothing touched the ticket, but the state is computed on read, so the new
    // targets apply to it immediately.
    const detail = await request.get(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
    });
    const body = await detail.json();

    const createdAt = new Date(body.created_at);
    expect(new Date(body.sla.firstResponse.dueAt) - createdAt).toBe(90 * 60_000);
    expect(new Date(body.sla.resolution.dueAt) - createdAt).toBe(180 * 60_000);
  });

  test('resolving a ticket records when, and clears it if reopened', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const resolved = await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
      data: { status: 'resolved' },
    });
    const resolvedBody = await resolved.json();
    expect(resolvedBody.resolved_at).not.toBeNull();
    expect(resolvedBody.sla.resolution.achievedAt).not.toBeNull();
    expect(resolvedBody.sla.resolution.state).toBe('met');

    const reopened = await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
      data: { status: 'open' },
    });
    const reopenedBody = await reopened.json();
    expect(reopenedBody.resolved_at).toBeNull();
    expect(reopenedBody.sla.resolution.achievedAt).toBeNull();
  });

  test('closing an already-resolved ticket keeps the original resolution time', async ({
    request,
  }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);

    const resolved = await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
      data: { status: 'resolved' },
    });
    const first = (await resolved.json()).resolved_at;

    const closed = await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
      data: { status: 'closed' },
    });
    expect((await closed.json()).resolved_at).toBe(first);
  });
});

// The state machine is pure, so it is cheaper and far more precise to drive it
// directly than to manufacture each case through the API.
test.describe('SLA state arithmetic', () => {
  const created = new Date('2026-01-01T00:00:00Z');
  const minutes = 100;

  test('met when achieved inside the window, breached when achieved after', () => {
    const inside = slaService.targetState(
      created,
      new Date('2026-01-01T01:00:00Z'),
      minutes,
      new Date('2026-01-01T02:00:00Z'),
    );
    expect(inside.state).toBe('met');

    const late = slaService.targetState(
      created,
      new Date('2026-01-01T03:00:00Z'),
      minutes,
      new Date('2026-01-01T04:00:00Z'),
    );
    expect(late.state).toBe('breached');
  });

  test('pending, then at risk at three quarters, then breached', () => {
    const early = slaService.targetState(created, null, minutes, new Date('2026-01-01T00:30:00Z'));
    expect(early.state).toBe('pending');

    // 75 of 100 minutes gone.
    const late = slaService.targetState(created, null, minutes, new Date('2026-01-01T01:15:00Z'));
    expect(late.state).toBe('at_risk');

    const over = slaService.targetState(created, null, minutes, new Date('2026-01-01T02:00:00Z'));
    expect(over.state).toBe('breached');
  });

  test('the worst of the two targets is what the badge shows', () => {
    expect(slaService.summarize({ state: 'met' }, { state: 'breached' })).toBe('breached');
    expect(slaService.summarize({ state: 'breached' }, { state: 'met' })).toBe('breached');
    expect(slaService.summarize({ state: 'met' }, { state: 'at_risk' })).toBe('at_risk');
    expect(slaService.summarize({ state: 'met' }, { state: 'met' })).toBe('met');
  });

  test('no policy means nothing is measured, not a broken badge', () => {
    expect(slaService.buildSla({ created_at: created, resolved_at: null }, undefined, null)).toBe(
      null,
    );
  });
});
