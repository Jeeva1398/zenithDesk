const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/token');

async function login({ email, password }) {
  const [rows] = await pool.query(
    `SELECT agents.*, organizations.name AS org_name
     FROM agents
     JOIN organizations ON organizations.id = agents.org_id
     WHERE agents.email = ?`,
    [email],
  );
  const agent = rows[0];
  if (!agent) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const valid = await comparePassword(password, agent.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  return {
    token: signToken({ agentId: agent.id, orgId: agent.org_id, role: agent.role, email: agent.email }),
    agent: {
      id: agent.id,
      orgId: agent.org_id,
      orgName: agent.org_name,
      name: agent.name,
      email: agent.email,
      role: agent.role,
    },
  };
}

module.exports = { login };
