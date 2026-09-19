const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

// Used when a new organization signs up. Existing orgs were backfilled with the
// same numbers by the migration that created the table.
const DEFAULT_POLICIES = [
  { priority: 'urgent', first_response_minutes: 30, resolution_minutes: 240 },
  { priority: 'high', first_response_minutes: 60, resolution_minutes: 480 },
  { priority: 'medium', first_response_minutes: 240, resolution_minutes: 1440 },
  { priority: 'low', first_response_minutes: 480, resolution_minutes: 2880 },
];

// A target counts as at risk once three quarters of its window has gone. It is a
// display threshold, not a stored state, so changing it never needs a migration
// or a backfill.
const AT_RISK_FRACTION = 0.75;

const MAX_MINUTES = 60 * 24 * 365;

async function seedDefaults(db) {
  for (const policy of DEFAULT_POLICIES) {
    await db.insert('sla_policies', policy);
  }
}

async function listPolicies(orgId) {
  const policies = await forOrg(orgId).list(
    'sla_policies',
    {},
    { columns: 'id, priority, first_response_minutes, resolution_minutes' },
  );

  // Ordered by urgency rather than alphabetically, because that is the order an
  // agent reads them in.
  const byPriority = new Map(policies.map((p) => [p.priority, p]));
  return { policies: [...PRIORITIES].reverse().map((p) => byPriority.get(p)).filter(Boolean) };
}

function validateMinutes(value, field) {
  const minutes = Number(value);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > MAX_MINUTES) {
    throw new ApiError(400, `${field} must be a whole number of minutes between 1 and ${MAX_MINUTES}`);
  }
  return minutes;
}

async function updatePolicy(orgId, policyId, { firstResponseMinutes, resolutionMinutes }) {
  const updates = {};
  if (firstResponseMinutes !== undefined) {
    updates.first_response_minutes = validateMinutes(firstResponseMinutes, 'firstResponseMinutes');
  }
  if (resolutionMinutes !== undefined) {
    updates.resolution_minutes = validateMinutes(resolutionMinutes, 'resolutionMinutes');
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  const db = forOrg(orgId);
  const existing = await db.get('sla_policies', policyId, 'SLA policy not found');

  // Resolving before the first reply is impossible, so a policy that asks for it
  // would mark healthy tickets as breached.
  const firstResponse = updates.first_response_minutes ?? existing.first_response_minutes;
  const resolution = updates.resolution_minutes ?? existing.resolution_minutes;
  if (resolution < firstResponse) {
    throw new ApiError(400, 'resolutionMinutes cannot be shorter than firstResponseMinutes');
  }

  await db.update('sla_policies', policyId, updates, 'SLA policy not found');
  return db.get('sla_policies', policyId, 'SLA policy not found', {
    columns: 'id, priority, first_response_minutes, resolution_minutes',
  });
}

function addMinutes(date, minutes) {
  return new Date(new Date(date).getTime() + minutes * 60_000);
}

// Three outcomes, plus a warning shade on the one that is still running:
//   met      - it happened, and inside the window
//   breached - it happened late, or has not happened and the window has passed
//   at_risk  - still running, but most of the window is gone
//   pending  - still running, with room left
function targetState(startedAt, achievedAt, minutes, now) {
  const dueAt = addMinutes(startedAt, minutes);

  if (achievedAt) {
    return {
      dueAt,
      achievedAt: new Date(achievedAt),
      state: new Date(achievedAt) <= dueAt ? 'met' : 'breached',
    };
  }

  if (now > dueAt) {
    return { dueAt, achievedAt: null, state: 'breached' };
  }

  const elapsed = now - new Date(startedAt);
  const window = dueAt - new Date(startedAt);
  return {
    dueAt,
    achievedAt: null,
    state: elapsed / window >= AT_RISK_FRACTION ? 'at_risk' : 'pending',
  };
}

const RANK = { breached: 3, at_risk: 2, pending: 1, met: 0 };

// The badge shows one state per ticket: whichever of the two targets is in the
// most trouble, so a breach can never hide behind a met target.
function summarize(firstResponse, resolution) {
  return RANK[firstResponse.state] >= RANK[resolution.state]
    ? firstResponse.state
    : resolution.state;
}

function buildSla(ticket, policy, firstResponseAt, now = new Date()) {
  if (!policy) return null;

  const firstResponse = targetState(
    ticket.created_at,
    firstResponseAt,
    policy.first_response_minutes,
    now,
  );
  // resolved_at is set when the status first reaches resolved/closed, and the
  // migration backfilled it for rows that predate the column, so a finished
  // ticket always has one to measure against.
  const resolution = targetState(
    ticket.created_at,
    ticket.resolved_at,
    policy.resolution_minutes,
    now,
  );

  return {
    state: summarize(firstResponse, resolution),
    firstResponse,
    resolution,
  };
}

module.exports = {
  DEFAULT_POLICIES,
  AT_RISK_FRACTION,
  seedDefaults,
  listPolicies,
  updatePolicy,
  buildSla,
  targetState,
  summarize,
};
