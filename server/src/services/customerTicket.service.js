const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];

async function getCustomerId(orgId, email) {
  const [rows] = await pool.query('SELECT id FROM users WHERE org_id = ? AND email = ?', [
    orgId,
    email,
  ]);
  if (rows.length === 0) {
    throw new ApiError(404, 'Customer not found');
  }
  return rows[0].id;
}

async function listTickets(orgId, email) {
  const [rows] = await pool.query(
    `SELECT t.* FROM tickets t
     JOIN users u ON u.id = t.customer_id
     WHERE u.org_id = ? AND u.email = ?
     ORDER BY t.created_at DESC`,
    [orgId, email],
  );
  return rows;
}

async function getTicketById(orgId, email, ticketId) {
  const [rows] = await pool.query(
    `SELECT t.* FROM tickets t
     JOIN users u ON u.id = t.customer_id
     WHERE u.org_id = ? AND u.email = ? AND t.id = ?`,
    [orgId, email, ticketId],
  );
  const ticket = rows[0];
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  const [comments] = await pool.query(
    `SELECT tc.*,
       CASE WHEN tc.author_agent_id IS NOT NULL THEN 'agent' ELSE 'customer' END AS author_type,
       COALESCE(a.name, u.name) AS author_name
     FROM ticket_comments tc
     LEFT JOIN agents a ON a.id = tc.author_agent_id
     LEFT JOIN users u ON u.id = tc.author_customer_id
     WHERE tc.ticket_id = ?
     ORDER BY tc.created_at ASC`,
    [ticket.id],
  );

  return { ...ticket, comments };
}

async function createTicket(orgId, email, data) {
  const { subject, description, category, priority } = data;

  if (!subject || !description) {
    throw new ApiError(400, 'subject and description are required');
  }
  if (priority && !PRIORITIES.includes(priority)) {
    throw new ApiError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
  }

  const customerId = await getCustomerId(orgId, email);

  const [result] = await pool.query(
    `INSERT INTO tickets (org_id, customer_id, subject, description, category, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [orgId, customerId, subject, description, category || null, priority || 'medium'],
  );

  return getTicketById(orgId, email, result.insertId);
}

async function addComment(orgId, email, ticketId, body) {
  if (!body) {
    throw new ApiError(400, 'body is required');
  }

  const customerId = await getCustomerId(orgId, email);

  const [ticketRows] = await pool.query(
    'SELECT id FROM tickets WHERE id = ? AND org_id = ? AND customer_id = ?',
    [ticketId, orgId, customerId],
  );
  if (ticketRows.length === 0) {
    throw new ApiError(404, 'Ticket not found');
  }

  const [result] = await pool.query(
    `INSERT INTO ticket_comments (org_id, ticket_id, author_customer_id, body, created_at, updated_at)
     VALUES (?, ?, ?, ?, NOW(), NOW())`,
    [orgId, ticketId, customerId, body],
  );

  const [rows] = await pool.query('SELECT * FROM ticket_comments WHERE id = ?', [
    result.insertId,
  ]);
  return rows[0];
}

module.exports = { listTickets, getTicketById, createTicket, addComment };
