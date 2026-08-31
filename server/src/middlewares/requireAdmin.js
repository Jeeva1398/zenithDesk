const ApiError = require('../utils/ApiError');

function requireAdmin(req, res, next) {
  if (req.agent?.role !== 'admin') {
    throw new ApiError(403, 'Admin role required');
  }
  next();
}

module.exports = requireAdmin;
