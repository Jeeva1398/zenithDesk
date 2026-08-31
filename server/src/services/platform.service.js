const pool = require('../db/connection');

function paginationParams(filters) {
  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
  return { page, limit, offset: (page - 1) * limit };
}

async function listOrganizations() {
  const [rows] = await pool.query('SELECT * FROM organizations ORDER BY created_at DESC');
  return { organizations: rows };
}

async function listAgents() {
  const [rows] = await pool.query(
    `SELECT agents.id, agents.org_id, agents.name, agents.email, agents.role, agents.created_at,
            organizations.name AS org_name
     FROM agents
     JOIN organizations ON organizations.id = agents.org_id
     ORDER BY agents.created_at DESC`,
  );
  return { agents: rows };
}

// The one intentional exception to "always filter by org_id" (see
// zenithdesk-architecture.md §4) — this is a platform-wide view across all
// tenants, gated by authenticateSuperAdmin, not an org-scoped route.
async function listTickets(filters) {
  const { page, limit, offset } = paginationParams(filters);

  const [rows] = await pool.query(
    `SELECT tickets.*, organizations.name AS org_name
     FROM tickets
     JOIN organizations ON organizations.id = tickets.org_id
     ORDER BY tickets.created_at DESC
     LIMIT ? OFFSET ?`,
    [limit, offset],
  );

  return { tickets: rows, page, limit };
}

module.exports = { listOrganizations, listAgents, listTickets };
