const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const organizationService = require('../services/organization.service');

const signup = catchAsync(async (req, res) => {
  const { orgName, adminName, adminEmail, adminPassword } = req.body;
  if (!orgName || !adminName || !adminEmail || !adminPassword) {
    throw new ApiError(400, 'orgName, adminName, adminEmail, and adminPassword are required');
  }

  const result = await organizationService.signup({ orgName, adminName, adminEmail, adminPassword });
  res.status(201).json(result);
});

module.exports = { signup };
