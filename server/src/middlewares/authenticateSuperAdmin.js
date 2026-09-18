const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { verifyToken, TOKEN_TYPES } = require('../utils/token');

const authenticateSuperAdmin = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header');
  }

  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyToken(token, TOKEN_TYPES.SUPER_ADMIN);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }

  req.superAdmin = { id: payload.superAdminId };
  next();
});

module.exports = authenticateSuperAdmin;
