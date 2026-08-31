const jwt = require('jsonwebtoken');

function signToken(payload, options = {}) {
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: options.expiresIn || process.env.JWT_EXPIRES_IN || '1d',
  });
}

module.exports = { signToken };
