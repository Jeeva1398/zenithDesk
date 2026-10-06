const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const organizationService = require('../services/organization.service');

const signup = catchAsync(async (req, res) => {
  const { orgName, adminName, adminEmail, adminPassword, products } = req.body;
  if (!orgName || !adminName || !adminEmail || !adminPassword) {
    throw new ApiError(400, 'orgName, adminName, adminEmail, and adminPassword are required');
  }

  const result = await organizationService.signup({ orgName, adminName, adminEmail, adminPassword, products });
  res.status(201).json(result);
});

// The caller's own org, and which products it uses. The portal reads it to
// draw only what the org has, and again after an admin turns a product on.
const getMine = catchAsync(async (req, res) => {
  res.status(200).json(await organizationService.getOrganization(req.agent.orgId));
});

const enableProduct = catchAsync(async (req, res) => {
  const { product } = req.body;
  if (!product) {
    throw new ApiError(400, 'product is required');
  }
  res.status(200).json(await organizationService.enableProduct(req.agent.orgId, product));
});

module.exports = { signup, getMine, enableProduct };
