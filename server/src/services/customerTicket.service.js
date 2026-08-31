const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');

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
  return ticket;
}

module.exports = { listTickets, getTicketById };
