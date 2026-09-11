const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/password');

const ROLES = ['admin', 'agent'];

async function countAdmins(orgId) {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS count FROM agents WHERE org_id = ? AND role = 'admin'",
    [orgId],
  );
  return rows[0].count;
}

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

async function updateAgent(orgId, agentId, { name, email, role }) {
  const [existingRows] = await pool.query('SELECT * FROM agents WHERE id = ? AND org_id = ?', [
    agentId,
    orgId,
  ]);
  const existing = existingRows[0];
  if (!existing) {
    throw new ApiError(404, 'Agent not found');
  }

  if (role !== undefined && !ROLES.includes(role)) {
    throw new ApiError(400, `role must be one of: ${ROLES.join(', ')}`);
  }
  if (role === 'agent' && existing.role === 'admin' && (await countAdmins(orgId)) <= 1) {
    throw new ApiError(400, 'Cannot demote the last admin');
  }
  if (email !== undefined && email !== existing.email) {
    const [dupe] = await pool.query('SELECT id FROM agents WHERE email = ?', [email]);
    if (dupe.length > 0) {
      throw new ApiError(409, 'An agent with this email already exists');
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
  if (role !== undefined) {
    setClauses.push('role = ?');
    params.push(role);
  }
  if (setClauses.length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }
  setClauses.push('updated_at = NOW()');

  await pool.query(`UPDATE agents SET ${setClauses.join(', ')} WHERE id = ? AND org_id = ?`, [
    ...params,
    agentId,
    orgId,
  ]);

  const [rows] = await pool.query('SELECT id, name, email, role FROM agents WHERE id = ?', [
    agentId,
  ]);
  return rows[0];
}

async function deleteAgent(orgId, agentId, requestingAgentId) {
  if (Number(agentId) === Number(requestingAgentId)) {
    throw new ApiError(400, 'You cannot remove your own account');
  }

  const [rows] = await pool.query('SELECT role FROM agents WHERE id = ? AND org_id = ?', [
    agentId,
    orgId,
  ]);
  const existing = rows[0];
  if (!existing) {
    throw new ApiError(404, 'Agent not found');
  }
  if (existing.role === 'admin' && (await countAdmins(orgId)) <= 1) {
    throw new ApiError(400, 'Cannot remove the last admin');
  }

  await pool.query('DELETE FROM agents WHERE id = ? AND org_id = ?', [agentId, orgId]);
}

async function updateProfile(orgId, agentId, { name, email }) {
  if (email !== undefined) {
    const [dupe] = await pool.query('SELECT id FROM agents WHERE email = ? AND id <> ?', [
      email,
      agentId,
    ]);
    if (dupe.length > 0) {
      throw new ApiError(409, 'An agent with this email already exists');
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

  await pool.query(`UPDATE agents SET ${setClauses.join(', ')} WHERE id = ? AND org_id = ?`, [
    ...params,
    agentId,
    orgId,
  ]);

  const [rows] = await pool.query(
    `SELECT agents.id, agents.name, agents.email, agents.role, agents.org_id,
       organizations.name AS org_name
     FROM agents JOIN organizations ON organizations.id = agents.org_id
     WHERE agents.id = ?`,
    [agentId],
  );
  return rows[0];
}

async function changePassword(agentId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'currentPassword and newPassword are required');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'newPassword must be at least 8 characters');
  }

  const [rows] = await pool.query('SELECT password_hash FROM agents WHERE id = ?', [agentId]);
  const agent = rows[0];
  if (!agent) {
    throw new ApiError(404, 'Agent not found');
  }

  const valid = await comparePassword(currentPassword, agent.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query('UPDATE agents SET password_hash = ?, updated_at = NOW() WHERE id = ?', [
    passwordHash,
    agentId,
  ]);
}

module.exports = {
  createAgent,
  listAgents,
  updateAgent,
  deleteAgent,
  updateProfile,
  changePassword,
};
