const catchAsync = require('../utils/catchAsync');
const platformService = require('../services/platform.service');

const listOrganizations = catchAsync(async (req, res) => {
  const result = await platformService.listOrganizations();
  res.status(200).json(result);
});

const listAgents = catchAsync(async (req, res) => {
  const result = await platformService.listAgents();
  res.status(200).json(result);
});

const listTickets = catchAsync(async (req, res) => {
  const result = await platformService.listTickets(req.query);
  res.status(200).json(result);
});

module.exports = { listOrganizations, listAgents, listTickets };
