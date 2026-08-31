const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const customerAuthService = require('../services/customerAuth.service');

const requestOtp = catchAsync(async (req, res) => {
  const { orgId, email } = req.body;
  if (!orgId || !email) {
    throw new ApiError(400, 'orgId and email are required');
  }

  await customerAuthService.requestOtp(orgId, email);
  res.status(200).json({ message: 'If that email has an account, a verification code has been sent.' });
});

const verifyOtp = catchAsync(async (req, res) => {
  const { orgId, email, code } = req.body;
  if (!orgId || !email || !code) {
    throw new ApiError(400, 'orgId, email, and code are required');
  }

  const token = await customerAuthService.verifyOtp(orgId, email, code);
  res.status(200).json({ token });
});

module.exports = { requestOtp, verifyOtp };
