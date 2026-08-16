const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');

async function addComment(orgId, ticketId, agentId, body) {
  if (!body) {
    throw new ApiError(400, 'body is required');
  }

  const [ticketRows] = await pool.query('SELECT id FROM tickets WHERE id = ? AND org_id = ?', [
    ticketId,
    orgId,
  ]);
  if (ticketRows.length === 0) {
    throw new ApiError(404, 'Ticket not found');
  }

  const [result] = await pool.query(
    `INSERT INTO ticket_comments (org_id, ticket_id, author_agent_id, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [orgId, ticketId, agentId, body],
  );

  const [rows] = await pool.query('SELECT * FROM ticket_comments WHERE id = ?', [
    result.insertId,
  ]);
  return rows[0];
}

module.exports = { addComment };
