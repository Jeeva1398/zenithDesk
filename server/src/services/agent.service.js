const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { hashPassword } = require('../utils/password');

const ROLES = ['admin', 'agent'];

async function createAgent(orgId, { name, email, password, role }) {
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email, and password are required');
  }
  if (role && !ROLES.includes(role)) {
    throw new ApiError(400, `role must be one of: ${ROLES.join(', ')}`);
  }

  const [existing] = await pool.query('SELECT id FROM agents WHERE email = ?', [email]);
  if (existing.length > 0) {
    throw new ApiError(409, 'An agent with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const [result] = await pool.query(
    `INSERT INTO agents (org_id, name, email, password_hash, role, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
    [orgId, name, email, passwordHash, role || 'agent'],
  );

  return { id: result.insertId, orgId, name, email, role: role || 'agent' };
}

async function listAgents(orgId) {
  const [rows] = await pool.query(
    'SELECT id, name, email, role FROM agents WHERE org_id = ? ORDER BY name ASC',
    [orgId],
  );
  return { agents: rows };
}

module.exports = { createAgent, listAgents };
