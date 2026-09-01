const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { signToken } = require('../utils/token');
const { sendOtpEmail } = require('./email.service');

const OTP_TTL_MINUTES = 10;
const MAX_VERIFY_ATTEMPTS = 5;
const REQUEST_RATE_WINDOW_MINUTES = 15;
const REQUEST_RATE_LIMIT = 5;
const SALT_ROUNDS = 10;

function generateOtpCode() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, '0');
}

async function resolveOrgForEmail(email) {
  const [rows] = await pool.query(
    `SELECT o.id AS org_id, o.name AS org_name FROM users u
     JOIN organizations o ON o.id = u.org_id
     WHERE u.email = ?
     LIMIT 1`,
    [email],
  );
  const row = rows[0];
  if (!row) {
    throw new ApiError(404, 'No account found for that email');
  }
  return { orgId: row.org_id, orgName: row.org_name };
}

async function requestOtp(orgId, email) {
  const [rateRows] = await pool.query(
    `SELECT COUNT(*) AS count FROM customer_otps
     WHERE org_id = ? AND email = ? AND created_at > (NOW() - INTERVAL ? MINUTE)`,
    [orgId, email, REQUEST_RATE_WINDOW_MINUTES],
  );
  if (rateRows[0].count >= REQUEST_RATE_LIMIT) {
    throw new ApiError(429, 'Too many verification requests — please try again later');
  }

  const code = generateOtpCode();

  try {
    await sendOtpEmail(email, code);
  } catch {
    throw new ApiError(502, 'Failed to send verification email');
  }

  const codeHash = await bcrypt.hash(code, SALT_ROUNDS);
  await pool.query(
    `INSERT INTO customer_otps (org_id, email, otp_code_hash, expires_at, attempts, created_at, updated_at)
     VALUES (?, ?, ?, NOW() + INTERVAL ? MINUTE, 0, NOW(), NOW())`,
    [orgId, email, codeHash, OTP_TTL_MINUTES],
  );
}

async function verifyOtp(orgId, email, code) {
  const [rows] = await pool.query(
    `SELECT * FROM customer_otps
     WHERE org_id = ? AND email = ? AND expires_at > NOW()
     ORDER BY created_at DESC LIMIT 1`,
    [orgId, email],
  );
  const otp = rows[0];
  if (!otp) {
    throw new ApiError(401, 'Invalid or expired code');
  }
  if (otp.attempts >= MAX_VERIFY_ATTEMPTS) {
    throw new ApiError(429, 'Too many attempts — please request a new code');
  }

  const valid = await bcrypt.compare(code, otp.otp_code_hash);
  if (!valid) {
    await pool.query('UPDATE customer_otps SET attempts = attempts + 1, updated_at = NOW() WHERE id = ?', [otp.id]);
    throw new ApiError(401, 'Invalid or expired code');
  }

  await pool.query('DELETE FROM customer_otps WHERE org_id = ? AND email = ?', [orgId, email]);

  return signToken(
    { email, orgId, role: 'customer' },
    { expiresIn: process.env.CUSTOMER_JWT_EXPIRES_IN || '20m' },
  );
}

module.exports = { resolveOrgForEmail, requestOtp, verifyOtp };
