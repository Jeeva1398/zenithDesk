const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');

const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const STATUSES = ['open', 'pending', 'resolved', 'closed'];

async function findOrCreateCustomer(orgId, { customerName, customerEmail }) {
  const [rows] = await pool.query('SELECT id FROM users WHERE org_id = ? AND email = ?', [
    orgId,
    customerEmail,
  ]);
  if (rows.length > 0) {
    return rows[0].id;
  }

  const [result] = await pool.query(
    'INSERT INTO users (org_id, name, email, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
    [orgId, customerName, customerEmail],
  );
  return result.insertId;
}

async function createTicket(orgId, data) {
  const { customerName, customerEmail, subject, description, category, priority } = data;

  if (!customerName || !customerEmail || !subject || !description) {
    throw new ApiError(400, 'customerName, customerEmail, subject, and description are required');
  }
  if (priority && !PRIORITIES.includes(priority)) {
    throw new ApiError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
  }

  const customerId = await findOrCreateCustomer(orgId, { customerName, customerEmail });

  const [result] = await pool.query(
    `INSERT INTO tickets (org_id, customer_id, subject, description, category, priority, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [orgId, customerId, subject, description, category || null, priority || 'medium'],
  );

  return getTicketById(orgId, result.insertId);
}

async function listTickets(orgId, filters) {
  const conditions = ['t.org_id = ?'];
  const params = [orgId];

  if (filters.status) {
    conditions.push('t.status = ?');
    params.push(filters.status);
  }
  if (filters.priority) {
    conditions.push('t.priority = ?');
    params.push(filters.priority);
  }
  if (filters.category) {
    conditions.push('t.category = ?');
    params.push(filters.category);
  }
  if (filters.assignedAgentId) {
    conditions.push('t.assigned_agent_id = ?');
    params.push(filters.assignedAgentId);
  }

  const page = Math.max(parseInt(filters.page, 10) || 1, 1);
  const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
  const offset = (page - 1) * limit;

  const [rows] = await pool.query(
    `SELECT t.* FROM tickets t
     WHERE ${conditions.join(' AND ')}
     ORDER BY t.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  return { tickets: rows, page, limit };
}

async function getTicketById(orgId, ticketId) {
  const [rows] = await pool.query(
    `SELECT t.*, u.name AS customer_name, u.email AS customer_email
     FROM tickets t
     LEFT JOIN users u ON u.id = t.customer_id
     WHERE t.id = ? AND t.org_id = ?`,
    [ticketId, orgId],
  );
  const ticket = rows[0];
  if (!ticket) {
    throw new ApiError(404, 'Ticket not found');
  }

  const [comments] = await pool.query(
    'SELECT * FROM ticket_comments WHERE ticket_id = ? ORDER BY created_at ASC',
    [ticketId],
  );

  return { ...ticket, comments };
}

async function updateTicket(orgId, ticketId, updates) {
  const allowedFields = {
    status: STATUSES,
    priority: PRIORITIES,
  };

  const setClauses = [];
  const params = [];

  if (updates.status !== undefined) {
    if (!allowedFields.status.includes(updates.status)) {
      throw new ApiError(400, `status must be one of: ${STATUSES.join(', ')}`);
    }
    setClauses.push('status = ?');
    params.push(updates.status);
  }
  if (updates.priority !== undefined) {
    if (!allowedFields.priority.includes(updates.priority)) {
      throw new ApiError(400, `priority must be one of: ${PRIORITIES.join(', ')}`);
    }
    setClauses.push('priority = ?');
    params.push(updates.priority);
  }
  if (updates.assignedAgentId !== undefined) {
    setClauses.push('assigned_agent_id = ?');
    params.push(updates.assignedAgentId);
  }

  if (setClauses.length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  setClauses.push('updated_at = NOW()');

  const [result] = await pool.query(
    `UPDATE tickets SET ${setClauses.join(', ')} WHERE id = ? AND org_id = ?`,
    [...params, ticketId, orgId],
  );

  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Ticket not found');
  }

  return getTicketById(orgId, ticketId);
}

module.exports = { createTicket, listTickets, getTicketById, updateTicket };
