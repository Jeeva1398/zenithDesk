const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');

async function listCustomers(orgId) {
  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.created_at,
       COUNT(t.id) AS ticket_count,
       MAX(t.created_at) AS last_ticket_at
     FROM users u
     LEFT JOIN tickets t ON t.customer_id = u.id
     WHERE u.org_id = ?
     GROUP BY u.id
     ORDER BY u.name ASC`,
    [orgId],
  );
  return { customers: rows };
}

async function getCustomerById(orgId, customerId) {
  const [rows] = await pool.query(
    'SELECT id, name, email, created_at FROM users WHERE id = ? AND org_id = ?',
    [customerId, orgId],
  );
  const customer = rows[0];
  if (!customer) {
    throw new ApiError(404, 'Customer not found');
  }

  const [tickets] = await pool.query(
    `SELECT id, subject, status, priority, created_at
     FROM tickets WHERE customer_id = ? AND org_id = ?
     ORDER BY created_at DESC`,
    [customerId, orgId],
  );

  return { ...customer, tickets };
}

async function createCustomer(orgId, { name, email }) {
  if (!name || !email) {
    throw new ApiError(400, 'name and email are required');
  }

  const [existing] = await pool.query('SELECT id FROM users WHERE org_id = ? AND email = ?', [
    orgId,
    email,
  ]);
  if (existing.length > 0) {
    throw new ApiError(409, 'A customer with this email already exists');
  }

  const [result] = await pool.query(
    'INSERT INTO users (org_id, name, email, created_at, updated_at) VALUES (?, ?, ?, NOW(), NOW())',
    [orgId, name, email],
  );

  return getCustomerById(orgId, result.insertId);
}

async function updateCustomer(orgId, customerId, { name, email }) {
  if (email !== undefined) {
    const [dupe] = await pool.query(
      'SELECT id FROM users WHERE org_id = ? AND email = ? AND id <> ?',
      [orgId, email, customerId],
    );
    if (dupe.length > 0) {
      throw new ApiError(409, 'Another customer already uses this email');
    }
  }

  const setClauses = [];
  const params = [];
  if (name !== undefined) {
    setClauses.push('name = ?');
    params.push(name);
  }
  if (email !== undefined) {
    setClauses.push('email = ?');
    params.push(email);
  }
  if (setClauses.length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }
  setClauses.push('updated_at = NOW()');

  const [result] = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = ? AND org_id = ?`,
    [...params, customerId, orgId],
  );
  if (result.affectedRows === 0) {
    throw new ApiError(404, 'Customer not found');
  }

  return getCustomerById(orgId, customerId);
}

async function deleteCustomer(orgId, customerId) {
  const [rows] = await pool.query('SELECT id FROM users WHERE id = ? AND org_id = ?', [
    customerId,
    orgId,
  ]);
  if (rows.length === 0) {
    throw new ApiError(404, 'Customer not found');
  }

  const [ticketRows] = await pool.query(
    'SELECT COUNT(*) AS count FROM tickets WHERE customer_id = ? AND org_id = ?',
    [customerId, orgId],
  );
  if (ticketRows[0].count > 0) {
    throw new ApiError(409, 'Cannot delete a customer with existing tickets');
  }

  await pool.query('DELETE FROM users WHERE id = ? AND org_id = ?', [customerId, orgId]);
}

module.exports = {
  listCustomers,
  getCustomerById,
  createCustomer,
  updateCustomer,
  deleteCustomer,
};
