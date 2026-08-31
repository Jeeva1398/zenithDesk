const catchAsync = require('../utils/catchAsync');
const agentService = require('../services/agent.service');

const createAgent = catchAsync(async (req, res) => {
  const agent = await agentService.createAgent(req.agent.orgId, req.body);
  res.status(201).json(agent);
});

const listAgents = catchAsync(async (req, res) => {
  const result = await agentService.listAgents(req.agent.orgId);
  res.status(200).json(result);
});

module.exports = { createAgent, listAgents };
