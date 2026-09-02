const catchAsync = require('../utils/catchAsync');
const analyticsService = require('../services/analytics.service');

const ALLOWED_DAYS = [7, 30, 90];

const getOverview = catchAsync(async (req, res) => {
  const requestedDays = Number(req.query.days);
  const days = ALLOWED_DAYS.includes(requestedDays) ? requestedDays : 30;
  const result = await analyticsService.getOverview(req.agent.orgId, days);
  res.status(200).json(result);
});

module.exports = { getOverview };
