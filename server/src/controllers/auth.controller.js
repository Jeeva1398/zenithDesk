const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const authService = require('../services/auth.service');

const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    throw new ApiError(400, 'email and password are required');
  }

  const result = await authService.login({ email, password });
  res.status(200).json(result);
});

const refresh = catchAsync(async (req, res) => {
  const result = await authService.refresh(req.body.refreshToken);
  res.status(200).json(result);
});

// Always 204, whether or not the token was still live. Telling a caller that
// the token they handed over was already dead is information they cannot use
// and an attacker can.
const logout = catchAsync(async (req, res) => {
  await authService.logout(req.body.refreshToken);
  res.status(204).send();
});

module.exports = { login, refresh, logout };
