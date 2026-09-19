const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { comparePassword } = require('../utils/password');
const { signToken, TOKEN_TYPES } = require('../utils/token');

async function login({ email, password }) {
  const [rows] = await pool.query(
    `/* unscoped: login is by email alone, with no org context yet */
     SELECT agents.*, organizations.name AS org_name
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
    token: signToken({
      typ: TOKEN_TYPES.AGENT,
      agentId: agent.id,
      orgId: agent.org_id,
      role: agent.role,
      email: agent.email,
    }),
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
