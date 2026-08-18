const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');

const SALT_ROUNDS = 10;

function signToken({ agentId, orgId, email }) {
  return jwt.sign({ agentId, orgId, email }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '1d',
  });
}

async function register({ orgName, name, email, password }) {
  const [existing] = await pool.query('SELECT id FROM agents WHERE email = ?', [email]);
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

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const [agentResult] = await connection.query(
      'INSERT INTO agents (org_id, name, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, NOW(), NOW())',
      [orgId, name, email, passwordHash],
    );

    await connection.commit();

    const agentId = agentResult.insertId;
    return {
      token: signToken({ agentId, orgId, email }),
      agent: { id: agentId, orgId, orgName, name, email },
    };
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

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

  const valid = await bcrypt.compare(password, agent.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  return {
    token: signToken({ agentId: agent.id, orgId: agent.org_id, email: agent.email }),
    agent: {
      id: agent.id,
      orgId: agent.org_id,
      orgName: agent.org_name,
      name: agent.name,
      email: agent.email,
    },
  };
}

module.exports = { register, login };
