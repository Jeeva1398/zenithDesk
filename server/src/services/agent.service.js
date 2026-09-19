const pool = require('../db/connection');
const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const { hashPassword, comparePassword } = require('../utils/password');

const ROLES = ['admin', 'agent'];

// Agent email is unique across the whole platform, not per organization,
// because login is by email alone with no org identifier. The uniqueness
// check therefore has to look past the caller's own org.
async function emailTaken(email, exceptAgentId) {
  const [rows] = await pool.query(
    '/* unscoped: agent email is globally unique, so this spans orgs */ ' +
      'SELECT id FROM agents WHERE email = ? AND (? IS NULL OR id <> ?)',
    [email, exceptAgentId ?? null, exceptAgentId ?? null],
  );
  return rows.length > 0;
}

async function createAgent(orgId, { name, email, password, role }) {
  if (!name || !email || !password) {
    throw new ApiError(400, 'name, email, and password are required');
  }
  if (role && !ROLES.includes(role)) {
    throw new ApiError(400, `role must be one of: ${ROLES.join(', ')}`);
  }
  if (await emailTaken(email)) {
    throw new ApiError(409, 'An agent with this email already exists');
  }

  const passwordHash = await hashPassword(password);
  const agentId = await forOrg(orgId).insert('agents', {
    name,
    email,
    password_hash: passwordHash,
    role: role || 'agent',
  });

  return { id: agentId, orgId, name, email, role: role || 'agent' };
}

async function listAgents(orgId) {
  const agents = await forOrg(orgId).list(
    'agents',
    {},
    { columns: 'id, name, email, role', orderBy: 'name ASC' },
  );
  return { agents };
}

async function updateAgent(orgId, agentId, { name, email, role }) {
  const db = forOrg(orgId);
  const existing = await db.get('agents', agentId, 'Agent not found');

  if (role !== undefined && !ROLES.includes(role)) {
    throw new ApiError(400, `role must be one of: ${ROLES.join(', ')}`);
  }
  if (role === 'agent' && existing.role === 'admin' && (await countAdmins(db)) <= 1) {
    throw new ApiError(400, 'Cannot demote the last admin');
  }
  if (email !== undefined && email !== existing.email && (await emailTaken(email))) {
    throw new ApiError(409, 'An agent with this email already exists');
  }

  const updates = {};
  if (name !== undefined) {
    updates.name = name;
  }
  if (email !== undefined) {
    updates.email = email;
  }
  if (role !== undefined) {
    updates.role = role;
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  await db.update('agents', agentId, updates, 'Agent not found');
  return db.get('agents', agentId, 'Agent not found', { columns: 'id, name, email, role' });
}

async function deleteAgent(orgId, agentId, requestingAgentId) {
  if (Number(agentId) === Number(requestingAgentId)) {
    throw new ApiError(400, 'You cannot remove your own account');
  }

  const db = forOrg(orgId);
  const existing = await db.get('agents', agentId, 'Agent not found', { columns: 'role' });
  if (existing.role === 'admin' && (await countAdmins(db)) <= 1) {
    throw new ApiError(400, 'Cannot remove the last admin');
  }

  await db.remove('agents', agentId, 'Agent not found');
}

async function updateProfile(orgId, agentId, { name, email }) {
  const db = forOrg(orgId);

  if (email !== undefined && (await emailTaken(email, agentId))) {
    throw new ApiError(409, 'An agent with this email already exists');
  }

  const updates = {};
  if (name !== undefined) {
    updates.name = name;
  }
  if (email !== undefined) {
    updates.email = email;
  }
  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'No valid fields to update');
  }

  await db.update('agents', agentId, updates, 'Agent not found');

  const rows = await db.sql(
    `SELECT agents.id, agents.name, agents.email, agents.role, agents.org_id,
       organizations.name AS org_name
     FROM agents JOIN organizations ON organizations.id = agents.org_id
     WHERE agents.id = ? AND agents.org_id = :orgId`,
    [agentId],
  );
  return rows[0];
}

async function changePassword(orgId, agentId, currentPassword, newPassword) {
  if (!currentPassword || !newPassword) {
    throw new ApiError(400, 'currentPassword and newPassword are required');
  }
  if (newPassword.length < 8) {
    throw new ApiError(400, 'newPassword must be at least 8 characters');
  }

  const db = forOrg(orgId);
  const agent = await db.get('agents', agentId, 'Agent not found', { columns: 'password_hash' });

  const valid = await comparePassword(currentPassword, agent.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Current password is incorrect');
  }

  await db.update('agents', agentId, { password_hash: await hashPassword(newPassword) });
}

async function countAdmins(db) {
  return db.count('agents', { role: 'admin' });
}

module.exports = {
  createAgent,
  listAgents,
  updateAgent,
  deleteAgent,
  updateProfile,
  changePassword,
};
