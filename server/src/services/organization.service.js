const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { hashPassword } = require('../utils/password');
const { signToken } = require('../utils/token');

async function signup({ orgName, adminName, adminEmail, adminPassword }) {
  const [existing] = await pool.query('SELECT id FROM agents WHERE email = ?', [adminEmail]);
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

    await connection.commit();

    const agentId = agentResult.insertId;
    return {
      token: signToken({ agentId, orgId, role: 'admin', email: adminEmail }),
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
