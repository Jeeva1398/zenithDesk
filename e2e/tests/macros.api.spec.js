const { test, expect } = require('@playwright/test');
const { API_URL, createOrg, createTicket, uniqueClientIp, unique, PASSWORD } = require('../helpers');

function auth(token) {
  return { Authorization: `Bearer ${token}`, 'X-ZenithDesk-Client-IP': uniqueClientIp() };
}

async function createMacro(request, token, actions, name = unique('Macro')) {
  const res = await request.post(`${API_URL}/macros`, {
    headers: auth(token),
    data: { name, actions },
  });
  return { res, body: res.ok() ? await res.json() : await res.json().catch(() => ({})) };
}

test.describe('macros CRUD', () => {
  test('a macro round-trips its actions', async ({ request }) => {
    const org = await createOrg(request);
    const { res, body } = await createMacro(request, org.token, {
      status: 'resolved',
      priority: 'low',
      comment: 'Closing this out.',
    });

    expect(res.status()).toBe(201);
    expect(body.actions).toEqual({
      status: 'resolved',
      priority: 'low',
      comment: 'Closing this out.',
    });

    const list = await request.get(`${API_URL}/macros`, { headers: auth(org.token) });
    const { macros } = await list.json();
    expect(macros.some((m) => m.id === body.id)).toBe(true);
  });

  test('a macro must do something', async ({ request }) => {
    const org = await createOrg(request);
    const { res } = await createMacro(request, org.token, {});
    expect(res.status()).toBe(400);
  });

  test('actions are validated against the same enums as a ticket', async ({ request }) => {
    const org = await createOrg(request);

    const badStatus = await createMacro(request, org.token, { status: 'archived' });
    expect(badStatus.res.status()).toBe(400);

    const badPriority = await createMacro(request, org.token, { priority: 'catastrophic' });
    expect(badPriority.res.status()).toBe(400);
  });

  test('a blank comment is refused rather than silently dropped', async ({ request }) => {
    const org = await createOrg(request);
    const { res } = await createMacro(request, org.token, { comment: '   ' });
    expect(res.status()).toBe(400);
  });

  test('names are unique per org, and only per org', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const name = unique('Shared name');

    const first = await createMacro(request, orgA.token, { status: 'pending' }, name);
    expect(first.res.status()).toBe(201);

    const dupe = await createMacro(request, orgA.token, { status: 'open' }, name);
    expect(dupe.res.status()).toBe(409);

    // The same name in a different tenant is a different macro, not a conflict.
    const other = await createMacro(request, orgB.token, { status: 'open' }, name);
    expect(other.res.status()).toBe(201);
  });

  test('a macro is invisible to another org', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const { body: macro } = await createMacro(request, orgA.token, { status: 'pending' });

    const list = await request.get(`${API_URL}/macros`, { headers: auth(orgB.token) });
    const { macros } = await list.json();
    expect(macros.some((m) => m.id === macro.id)).toBe(false);

    const patch = await request.patch(`${API_URL}/macros/${macro.id}`, {
      headers: auth(orgB.token),
      data: { name: 'Stolen' },
    });
    expect(patch.status()).toBe(404);

    const del = await request.delete(`${API_URL}/macros/${macro.id}`, {
      headers: auth(orgB.token),
    });
    expect(del.status()).toBe(404);
  });
});

test.describe('applying a macro', () => {
  test('applies every action in one request', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token, { priority: 'urgent' });
    const { body: macro } = await createMacro(request, org.token, {
      status: 'resolved',
      priority: 'low',
      comment: 'Handled by macro.',
    });

    const res = await request.post(`${API_URL}/tickets/${ticket.id}/apply-macro`, {
      headers: auth(org.token),
      data: { macroId: macro.id },
    });

    expect(res.status()).toBe(200);
    const updated = await res.json();
    expect(updated.status).toBe('resolved');
    expect(updated.priority).toBe('low');
    expect(updated.comments.some((c) => c.body === 'Handled by macro.')).toBe(true);
  });

  test('a comment-only macro leaves the other fields alone', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token, { priority: 'high' });
    const { body: macro } = await createMacro(request, org.token, { comment: 'Just a note.' });

    const res = await request.post(`${API_URL}/tickets/${ticket.id}/apply-macro`, {
      headers: auth(org.token),
      data: { macroId: macro.id },
    });

    const updated = await res.json();
    expect(updated.priority).toBe('high');
    expect(updated.status).toBe(ticket.status);
    expect(updated.comments.some((c) => c.body === 'Just a note.')).toBe(true);
  });

  test("another org's macro cannot be applied to your ticket", async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketB = await createTicket(request, orgB.token);
    const { body: macroA } = await createMacro(request, orgA.token, { status: 'closed' });

    const res = await request.post(`${API_URL}/tickets/${ticketB.id}/apply-macro`, {
      headers: auth(orgB.token),
      data: { macroId: macroA.id },
    });

    expect(res.status()).toBe(404);
  });

  test('a macro cannot be applied to another org ticket', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketB = await createTicket(request, orgB.token);
    const { body: macroA } = await createMacro(request, orgA.token, { status: 'closed' });

    const res = await request.post(`${API_URL}/tickets/${ticketB.id}/apply-macro`, {
      headers: auth(orgA.token),
      data: { macroId: macroA.id },
    });

    expect(res.status()).toBe(404);
  });
});

// Found by driving the API during the macros phase: the UPDATE was org-scoped, so
// a caller could only reach their own ticket, but the assignedAgentId written into
// it was never checked - an agent could assign their ticket to an agent in another
// organization. Macros set an assignee too, so both paths are covered here.
test.describe('assignee must belong to the org', () => {
  async function agentInOwnOrg(request, org) {
    const email = `${unique('mate')}@example.com`;
    const created = await request.post(`${API_URL}/agents`, {
      headers: auth(org.token),
      data: { name: 'Team Mate', email, password: PASSWORD, role: 'agent' },
    });
    return (await created.json()).id;
  }

  test('a same-org agent can be assigned', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const mateId = await agentInOwnOrg(request, org);

    const res = await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
      data: { assignedAgentId: mateId },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).assigned_agent_id).toBe(mateId);
  });

  test('an agent from another org is refused', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketA = await createTicket(request, orgA.token);
    const strangerId = await agentInOwnOrg(request, orgB);

    const res = await request.patch(`${API_URL}/tickets/${ticketA.id}`, {
      headers: auth(orgA.token),
      data: { assignedAgentId: strangerId },
    });

    expect(res.status()).toBe(404);

    const after = await request.get(`${API_URL}/tickets/${ticketA.id}`, {
      headers: auth(orgA.token),
    });
    expect((await after.json()).assigned_agent_id).toBeNull();
  });

  test('a macro cannot smuggle in a foreign assignee', async ({ request }) => {
    const orgA = await createOrg(request);
    const orgB = await createOrg(request);
    const ticketA = await createTicket(request, orgA.token);
    const strangerId = await agentInOwnOrg(request, orgB);

    const { body: macro } = await createMacro(request, orgA.token, {
      assignedAgentId: strangerId,
    });

    const res = await request.post(`${API_URL}/tickets/${ticketA.id}/apply-macro`, {
      headers: auth(orgA.token),
      data: { macroId: macro.id },
    });

    expect(res.status()).toBe(404);
  });

  test('unassigning still works', async ({ request }) => {
    const org = await createOrg(request);
    const ticket = await createTicket(request, org.token);
    const mateId = await agentInOwnOrg(request, org);

    await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
      data: { assignedAgentId: mateId },
    });

    const res = await request.patch(`${API_URL}/tickets/${ticket.id}`, {
      headers: auth(org.token),
      data: { assignedAgentId: null },
    });

    expect(res.status()).toBe(200);
    expect((await res.json()).assigned_agent_id).toBeNull();
  });
});
