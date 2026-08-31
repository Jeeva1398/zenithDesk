const catchAsync = require('../utils/catchAsync');
const viewService = require('../services/view.service');

const listViews = catchAsync(async (req, res) => {
  const result = await viewService.listViews(req.agent.orgId);
  res.status(200).json(result);
});

const createView = catchAsync(async (req, res) => {
  const view = await viewService.createView(req.agent.orgId, req.agent.id, req.body);
  res.status(201).json(view);
});

const updateView = catchAsync(async (req, res) => {
  const view = await viewService.updateView(req.agent.orgId, req.params.id, req.body);
  res.status(200).json(view);
});

const deleteView = catchAsync(async (req, res) => {
  await viewService.deleteView(req.agent.orgId, req.params.id);
  res.status(204).send();
});

module.exports = { listViews, createView, updateView, deleteView };
