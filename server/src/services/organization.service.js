const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { hashPassword } = require('../utils/password');
const { signToken, TOKEN_TYPES } = require('../utils/token');
const { DEFAULT_POLICIES } = require('./sla.service');
const chatWidgetService = require('./chatWidget.service');
const refreshTokenService = require('./refreshToken.service');

async function signup({ orgName, adminName, adminEmail, adminPassword }) {
  const [existing] = await pool.query('/* unscoped: agent email is globally unique, so this spans orgs */ SELECT id FROM agents WHERE email = ?', [adminEmail]);
  if (existing.length > 0) {
    throw new ApiError(409, 'An agent with this email already exists');
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    const [orgResult] = await connection.query(
      'INSERT INTO organizations (name, created_at, updated_at) VALUES (?, NOW(), NOW())',
      [orgName],
    );
    const orgId = orgResult.insertId;

    const passwordHash = await hashPassword(adminPassword);
    const [agentResult] = await connection.query(
      `INSERT INTO agents (org_id, name, email, password_hash, role, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'admin', NOW(), NOW())`,
      [orgId, adminName, adminEmail, passwordHash],
    );

    // Seeded inside the transaction so an organization can never exist without
    // the targets its tickets are measured against. Written through the
    // connection rather than forOrg() because the helper uses the pool, which
    // would put these rows outside the transaction.
    await connection.query(
      `INSERT INTO sla_policies
         (org_id, priority, first_response_minutes, resolution_minutes, created_at, updated_at)
       VALUES ?`,
      [
        DEFAULT_POLICIES.map((p) => [
          orgId,
          p.priority,
          p.first_response_minutes,
          p.resolution_minutes,
          new Date(),
          new Date(),
        ]),
      ],
    );

    // Same reasoning: every org has exactly one widget row, so its embed key
    // exists from the first moment an admin opens Settings.
    await chatWidgetService.seedDefaults(connection, orgId);

    await connection.commit();

    const agentId = agentResult.insertId;
    return {
      token: signToken({ typ: TOKEN_TYPES.AGENT, agentId, orgId, role: 'admin', email: adminEmail }),
      // Signing up signs you in, so it returns the same session shape as login -
      // otherwise the first short-lived access token would expire with nothing
      // to renew it. Issued after the commit, because the scope helper uses the
      // pool rather than this transaction's connection.
      refreshToken: await refreshTokenService.issue(orgId, agentId),
      agent: { id: agentId, orgId, orgName, name: adminName, email: adminEmail, role: 'admin' },
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

module.exports = { signup };
