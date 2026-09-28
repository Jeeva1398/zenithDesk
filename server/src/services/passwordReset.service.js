const crypto = require('crypto');
const pool = require('../db/connection');
const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');
const { hashPassword, assertPasswordPolicy } = require('../utils/password');
const refreshTokenService = require('./refreshToken.service');
const emailService = require('./email.service');
const logger = require('../config/logger');

// "Forgot password" for agents. A link with a single-use token is emailed;
// only its hash is stored. Like login, this runs before there is any org
// context - an agent's email is unique across the platform - so the lookups
// by email and by token are unscoped on purpose.

const TOKEN_BYTES = 32;
const TTL_MINUTES = 30;
const INVALID = 'This reset link is invalid or has expired - ask for a new one.';

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function resetLink(token) {
  const base = (process.env.PORTAL_URL || 'http://localhost:5173').replace(/\/$/, '');
  return `${base}/reset-password?token=${token}`;
}

// Answers the same whether or not the email has an account, so the form
// cannot be used to find out who does. The email goes out in the background
// for the same reason: a slow send would otherwise give a known address away.
async function requestReset(email) {
  if (typeof email !== 'string' || !email.trim()) throw new ApiError(400, 'email is required');

  const [rows] = await pool.query(
    `/* unscoped: a password reset starts from an email alone, with no org context yet */
     SELECT id, org_id, email FROM agents WHERE email = ? LIMIT 1`,
    [email.trim().toLowerCase()],
  );
  const agent = rows[0];
  if (!agent) return;

  const db = forOrg(agent.org_id);
  // A new link retires any earlier one, so only the latest email works.
  await db.sql(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE org_id = :orgId AND agent_id = ? AND used_at IS NULL',
    [agent.id],
  );

  const token = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  await db.sql(
    `INSERT INTO password_reset_tokens (org_id, agent_id, token_hash, expires_at, created_at, updated_at)
     VALUES (:orgId, ?, ?, NOW() + INTERVAL ? MINUTE, NOW(), NOW())`,
    [agent.id, hashToken(token), TTL_MINUTES],
  );

  emailService
    .sendPasswordResetEmail(agent.email, { link: resetLink(token), minutes: TTL_MINUTES })
    .catch((err) => logger.error(`Sending a password reset email failed: ${err.message}`));
}

async function resetPassword(token, password) {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) throw new ApiError(400, INVALID);
  assertPasswordPolicy(password);

  const [rows] = await pool.query(
    `/* unscoped: the reset token is the only thing identifying the agent here */
     SELECT id, org_id, agent_id FROM password_reset_tokens
     WHERE token_hash = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
    [hashToken(token)],
  );
  const reset = rows[0];
  if (!reset) throw new ApiError(400, INVALID);

  const db = forOrg(reset.org_id);
  // Claimed before the password changes, so two uses of one link cannot both win.
  const claimed = await db.sql(
    'UPDATE password_reset_tokens SET used_at = NOW() WHERE org_id = :orgId AND id = ? AND used_at IS NULL',
    [reset.id],
  );
  if (!claimed.affectedRows) throw new ApiError(400, INVALID);

  await db.update('agents', reset.agent_id, { password_hash: await hashPassword(password) });
  // Whoever knew the old password is signed out everywhere.
  await refreshTokenService.revokeFamily(reset.org_id, reset.agent_id);
}

module.exports = { requestReset, resetPassword, TTL_MINUTES };
