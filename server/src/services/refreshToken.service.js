const crypto = require('crypto');
const pool = require('../db/connection');
const { forOrg } = require('../db/orgScope');
const ApiError = require('../utils/ApiError');

const TOKEN_BYTES = 32;
const DEFAULT_TTL_DAYS = 30;

// A refresh token is opaque random bytes, not a JWT. There is nothing to read
// out of it and nothing to forge: it is only ever a lookup key for a row, so
// its value comes entirely from the row being revocable.
function generateToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('hex');
}

// SHA-256 rather than bcrypt: this is 256 bits of random, not a human-chosen
// password, so there is no dictionary to slow down - and refresh happens on a
// hot path where a deliberate 100ms hash would be felt.
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function ttlDays() {
  const configured = Number(process.env.REFRESH_TOKEN_TTL_DAYS);
  return Number.isFinite(configured) && configured > 0 ? configured : DEFAULT_TTL_DAYS;
}

function expiryFromNow() {
  return new Date(Date.now() + ttlDays() * 24 * 60 * 60 * 1000);
}

async function issue(orgId, agentId) {
  const token = generateToken();
  await forOrg(orgId).insert('refresh_tokens', {
    agent_id: agentId,
    token_hash: hashToken(token),
    expires_at: expiryFromNow(),
  });
  return token;
}

// The presented token is the only thing the caller has, and it carries no org,
// so this one lookup cannot be org-scoped - the row is what tells us the org.
// Everything after this point goes through forOrg().
async function findByToken(token) {
  const [rows] = await pool.query(
    `/* unscoped: a refresh token carries no org - the row it matches is what identifies one */
     SELECT * FROM refresh_tokens WHERE token_hash = ? LIMIT 1`,
    [hashToken(token)],
  );
  return rows[0] || null;
}

// A null in the criteria becomes IS NULL, so this revokes every token for the
// agent that is still live, and leaves the already-dead ones alone.
async function revokeFamily(orgId, agentId) {
  return forOrg(orgId).update(
    'refresh_tokens',
    { agent_id: agentId, revoked_at: null },
    { revoked_at: new Date() },
  );
}

// Rotation: every refresh swaps the token for a new one and retires the old.
// A token that is presented twice is therefore either a replay or a theft, and
// since we cannot tell which, every session for that agent is cut - the
// legitimate holder re-logs in, and the thief gets nothing.
async function rotate(token) {
  const existing = await findByToken(token);
  if (!existing) {
    throw new ApiError(401, 'Invalid refresh token');
  }

  const db = forOrg(existing.org_id);

  if (existing.revoked_at) {
    await revokeFamily(existing.org_id, existing.agent_id);
    throw new ApiError(401, 'Refresh token has already been used');
  }

  if (new Date(existing.expires_at) <= new Date()) {
    throw new ApiError(401, 'Refresh token has expired');
  }

  const replacement = generateToken();
  const replacementId = await db.insert('refresh_tokens', {
    agent_id: existing.agent_id,
    token_hash: hashToken(replacement),
    expires_at: expiryFromNow(),
  });

  await db.update('refresh_tokens', existing.id, {
    revoked_at: new Date(),
    replaced_by_id: replacementId,
  });

  return { refreshToken: replacement, orgId: existing.org_id, agentId: existing.agent_id };
}

async function revoke(token) {
  const existing = await findByToken(token);
  if (!existing || existing.revoked_at) {
    // Logging out with a token that is already dead is not an error - the
    // caller wanted it gone, and it is gone.
    return false;
  }

  await forOrg(existing.org_id).update('refresh_tokens', existing.id, {
    revoked_at: new Date(),
  });
  return true;
}

module.exports = { issue, rotate, revoke, revokeFamily, hashToken, ttlDays };
