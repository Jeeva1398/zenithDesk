const pool = require('../db/connection');
const ApiError = require('../utils/ApiError');
const { comparePassword } = require('../utils/password');
const { signToken } = require('../utils/token');

async function login({ email, password }) {
  const [rows] = await pool.query('SELECT * FROM super_admins WHERE email = ?', [email]);
  const superAdmin = rows[0];
  if (!superAdmin) {
    throw new ApiError(401, 'Invalid email or password');
  }

  const valid = await comparePassword(password, superAdmin.password_hash);
  if (!valid) {
    throw new ApiError(401, 'Invalid email or password');
  }

  return {
    token: signToken({ superAdminId: superAdmin.id, role: 'super_admin' }),
    superAdmin: { id: superAdmin.id, name: superAdmin.name, email: superAdmin.email },
  };
}

module.exports = { login };
