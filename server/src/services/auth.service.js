const pool = require('../db/connection');
const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const { comparePassword } = require('../utils/password');
const { signToken, TOKEN_TYPES } = require('../utils/token');
const refreshTokenService = require('./refreshToken.service');

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
    // The access token is now short-lived, so the client needs something to
    // renew it with. This is the only place a refresh token is minted from
    // credentials; every one after it comes from rotating this one.
    refreshToken: await refreshTokenService.issue(agent.org_id, agent.id),
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

// Exchanges a refresh token for a new access token, and for a new refresh token
// - the old one is retired in the same step, so a token is only ever good once.
async function refresh(token) {
  if (!token) {
    throw new ApiError(400, 'refreshToken is required');
  }

  const { refreshToken, orgId, agentId } = await refreshTokenService.rotate(token);
  // Joined for org_name because the client replaces its stored agent with this
  // one, and the shell reads the organization name off it - a leaner payload
  // here would blank the sidebar on the first refresh.
  const rows = await forOrg(orgId).sql(
    `SELECT agents.*, organizations.name AS org_name
     FROM agents JOIN organizations ON organizations.id = agents.org_id
     WHERE agents.id = ? AND agents.org_id = :orgId`,
    [agentId],
  );
  const agent = rows[0];
  if (!agent) {
    throw new ApiError(401, 'Agent no longer exists');
  }

  return {
    token: signToken({
      typ: TOKEN_TYPES.AGENT,
      agentId: agent.id,
      orgId: agent.org_id,
      role: agent.role,
      email: agent.email,
    }),
    refreshToken,
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

async function logout(token) {
  if (token) {
    await refreshTokenService.revoke(token);
  }
}

module.exports = { login, refresh, logout };
