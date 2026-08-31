const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const superAdminService = require('../services/superAdmin.service');

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const result = await superAdminService.login({ email, password });
  res.status(200).json(result);
});

module.exports = { login };
