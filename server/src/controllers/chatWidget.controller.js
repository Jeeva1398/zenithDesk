const catchAsync = require('../utils/catchAsync');
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

module.exports = { getSettings, updateSettings, regenerateKey, getPublicConfig };
