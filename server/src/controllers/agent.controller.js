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

const updateAgent = catchAsync(async (req, res) => {
  const agent = await agentService.updateAgent(req.agent.orgId, req.params.id, req.body);
  res.status(200).json(agent);
});

const deleteAgent = catchAsync(async (req, res) => {
  await agentService.deleteAgent(req.agent.orgId, req.params.id, req.agent.id);
  res.status(204).send();
});

const updateMe = catchAsync(async (req, res) => {
  const agent = await agentService.updateProfile(req.agent.orgId, req.agent.id, req.body);
  res.status(200).json(agent);
});

const changeMyPassword = catchAsync(async (req, res) => {
  await agentService.changePassword(req.agent.id, req.body.currentPassword, req.body.newPassword);
  res.status(204).send();
});

module.exports = { createAgent, listAgents, updateAgent, deleteAgent, updateMe, changeMyPassword };
