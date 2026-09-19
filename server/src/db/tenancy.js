// Every table here carries an org_id and must never be read or written
// without one. `organizations` and `super_admins` are platform-level, and
// `ticket_tags` is a pure join table whose rows are reachable only through a
// ticket that was already scoped, so none of them appear.
const ORG_SCOPED_TABLES = new Set([
  'users',
  'agents',
  'tickets',
  'ticket_comments',
  'tags',
  'views',
  'macros',
  'customer_otps',
]);

// A handful of queries are cross-tenant on purpose: the super-admin platform
// views, login lookups that have no org context yet, and the batch jobs.
// Rather than let the guard quietly allowlist them by table name, each one
// says so in the SQL itself, which keeps the exceptions greppable:
//
//   /* unscoped: super-admin platform view */
//
// Anything without the marker is treated as a mistake.
const UNSCOPED_MARKER = /\/\*\s*unscoped:/i;

// Matches the table name after the keywords that introduce one. Deliberately
// broad rather than a real SQL parser — the point is to catch a forgotten
// predicate in code review's blind spot, not to be a query planner.
const TABLE_REFERENCE = /\b(?:from|join|into|update|table)\s+`?([a-z_][a-z0-9_]*)`?/gi;

function statementText(sql) {
  if (typeof sql === 'string') return sql;
  if (sql && typeof sql.sql === 'string') return sql.sql;
  return '';
}

function scopedTablesIn(text) {
  const found = new Set();
  for (const match of text.matchAll(TABLE_REFERENCE)) {
    const table = match[1].toLowerCase();
    if (ORG_SCOPED_TABLES.has(table)) {
      found.add(table);
    }
  }
  return [...found];
}

// Throws on a statement that touches an org-scoped table without naming
// org_id anywhere. It cannot prove the predicate is the right one — a
// subquery mentioning org_id satisfies it — so it is a backstop under the
// scope helper, not a substitute for it.
function assertTenantScoped(sql) {
  const text = statementText(sql);
  if (!text || UNSCOPED_MARKER.test(text)) return;

  const tables = scopedTablesIn(text);
  if (tables.length === 0) return;
  if (/\borg_id\b/i.test(text)) return;

  throw new Error(
    `Query touches org-scoped table${tables.length > 1 ? 's' : ''} ` +
      `${tables.map((t) => `\`${t}\``).join(', ')} without an org_id predicate. ` +
      'Use forOrg(orgId) from db/orgScope, or mark the statement ' +
      '/* unscoped: <reason> */ if it is deliberately cross-tenant.\n' +
      `  ${text.trim().replace(/\s+/g, ' ').slice(0, 200)}`,
  );
}

module.exports = { ORG_SCOPED_TABLES, assertTenantScoped };
