const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const chatWidgetService = require('../services/chatWidget.service');

const getSettings = catchAsync(async (req, res) => {
  res.status(200).json(await chatWidgetService.getSettings(req.agent.orgId));
});

const updateSettings = catchAsync(async (req, res) => {
  res.status(200).json(await chatWidgetService.updateSettings(req.agent.orgId, req.body));
});

const regenerateKey = catchAsync(async (req, res) => {
  res.status(200).json(await chatWidgetService.regenerateKey(req.agent.orgId));
});

const getPublicConfig = catchAsync(async (req, res) => {
  res.status(200).json(await chatWidgetService.getPublicConfig(req.params.key));
});

const getSetup = catchAsync(async (req, res) => {
  res.status(200).json(await chatWidgetService.getSetup(req.agent.orgId));
});

// Only the chat server knows a page loaded the widget; an agent saying so
// would be ticking the checklist by hand.
const recordSeen = catchAsync(async (req, res) => {
  if (req.agent.role !== 'service') throw new ApiError(403, 'Only the chat server reports where the widget loaded');
  await chatWidgetService.recordSeen(req.agent.orgId, req.body?.origin);
  res.status(204).end();
});

module.exports = { getSettings, updateSettings, regenerateKey, getPublicConfig, getSetup, recordSeen };
