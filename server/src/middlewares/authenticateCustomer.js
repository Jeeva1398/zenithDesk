const ApiError = require('../utils/ApiError');
const catchAsync = require('../utils/catchAsync');
const { verifyToken, TOKEN_TYPES } = require('../utils/token');

const authenticateCustomer = catchAsync(async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new ApiError(401, 'Missing or invalid Authorization header');
  }

  const token = header.slice('Bearer '.length);

  let payload;
  try {
    payload = verifyToken(token, TOKEN_TYPES.CUSTOMER);
  } catch {
    throw new ApiError(401, 'Invalid or expired token');
  }

  req.customer = { email: payload.email, orgId: payload.orgId };
  next();
});

module.exports = authenticateCustomer;
