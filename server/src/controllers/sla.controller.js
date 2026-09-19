const catchAsync = require('../utils/catchAsync');
const slaService = require('../services/sla.service');

const listPolicies = catchAsync(async (req, res) => {
  const result = await slaService.listPolicies(req.agent.orgId);
  res.status(200).json(result);
});

const updatePolicy = catchAsync(async (req, res) => {
  const policy = await slaService.updatePolicy(req.agent.orgId, req.params.id, req.body);
  res.status(200).json(policy);
});

module.exports = { listPolicies, updatePolicy };
