const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 25;

// % and _ are wildcards inside LIKE, so a search for "50%" or "a_b" would
// otherwise match far more than the agent asked for. Backslash is MySQL's
// default LIKE escape character, which is why no ESCAPE clause is needed.
function likePattern(query) {
  return `%${query.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

// "#42" and "42" both mean ticket 42. Anything else is not an id, and passing
// null rather than 0 keeps the comparison honest - NULL never equals an id.
function asTicketId(query) {
  const match = /^#?(\d+)$/.exec(query.trim());
  return match ? Number(match[1]) : null;
}

// The minimum length exists to stop a one-character LIKE scanning the whole
// org. An id lookup is an exact match on an indexed column, so "7" is allowed
// through where "a" is not.
function normalize(query) {
  if (typeof query !== 'string') {
    throw new ApiError(400, `Search needs at least ${MIN_QUERY_LENGTH} characters`);
  }

  const trimmed = query.trim();
  if (trimmed.length < MIN_QUERY_LENGTH && asTicketId(trimmed) === null) {
    throw new ApiError(400, `Search needs at least ${MIN_QUERY_LENGTH} characters`);
  }

  return trimmed.slice(0, MAX_QUERY_LENGTH);
}

function clampLimit(limit) {
  const parsed = parseInt(limit, 10);
  if (!parsed || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

// A ticket matches on its own text, on who raised it, on its tags, or on its id.
// The joins are what make "search by customer email" and "search by tag" work
// from one box, which is the point of a global search rather than a list filter.
async function searchTickets(db, query, limit) {
  const pattern = likePattern(query);
  const ticketId = asTicketId(query);

  return db.sql(
    `SELECT DISTINCT t.id, t.subject, t.status, t.priority, t.created_at,
       u.name AS customer_name, u.email AS customer_email
     FROM tickets t
     LEFT JOIN users u ON u.id = t.customer_id AND u.org_id = :orgId
     LEFT JOIN ticket_tags tt ON tt.ticket_id = t.id
     LEFT JOIN tags tg ON tg.id = tt.tag_id AND tg.org_id = :orgId
     WHERE t.org_id = :orgId
       AND (
         t.id = ?
         OR t.subject LIKE ?
         OR t.description LIKE ?
         OR u.name LIKE ?
         OR u.email LIKE ?
         OR tg.name LIKE ?
       )
     ORDER BY (t.id = ?) DESC, (t.subject LIKE ?) DESC, t.created_at DESC
     LIMIT ?`,
    [ticketId, pattern, pattern, pattern, pattern, pattern, ticketId, pattern, limit],
  );
}

async function searchCustomers(db, query, limit) {
  const pattern = likePattern(query);

  return db.sql(
    `SELECT u.id, u.name, u.email, COUNT(t.id) AS ticket_count
     FROM users u
     LEFT JOIN tickets t ON t.customer_id = u.id AND t.org_id = :orgId
     WHERE u.org_id = :orgId AND (u.name LIKE ? OR u.email LIKE ?)
     GROUP BY u.id
     ORDER BY (u.email LIKE ?) DESC, u.name ASC
     LIMIT ?`,
    [pattern, pattern, pattern, limit],
  );
}

async function search(orgId, { q, limit } = {}) {
  const query = normalize(q);
  const capped = clampLimit(limit);
  const db = forOrg(orgId);

  const [tickets, customers] = await Promise.all([
    searchTickets(db, query, capped),
    searchCustomers(db, query, capped),
  ]);

  return { query, tickets, customers, total: tickets.length + customers.length };
}

module.exports = { search, likePattern, asTicketId, MIN_QUERY_LENGTH, MAX_LIMIT };
