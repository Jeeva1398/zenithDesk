const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const authService = require('../services/auth.service');

const register = catchAsync(async (req, res) => {
  const { orgName, name, email, password } = req.body;
  if (!orgName || !name || !email || !password) {
    throw new ApiError(400, 'orgName, name, email, and password are required');
  }

  const result = await authService.register({ orgName, name, email, password });
  res.status(201).json(result);
});

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const result = await authService.login({ email, password });
  res.status(200).json(result);
});

module.exports = { register, login };
