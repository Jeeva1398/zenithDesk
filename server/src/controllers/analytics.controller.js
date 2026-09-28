const catchAsync = require('../utils/catchAsync');
const ApiError = require('../utils/ApiError');
const analyticsService = require('../services/analytics.service');
const chatbotAnalyticsService = require('../services/chatbotAnalytics.service');

const ALLOWED_DAYS = [7, 30, 90];

function daysFrom(query) {
  const requestedDays = Number(query.days);
  return ALLOWED_DAYS.includes(requestedDays) ? requestedDays : 30;
}

const getOverview = catchAsync(async (req, res) => {
  const result = await analyticsService.getOverview(req.agent.orgId, daysFrom(req.query));
  res.status(200).json(result);
});

const getChatbotOverview = catchAsync(async (req, res) => {
  res.status(200).json(await chatbotAnalyticsService.getOverview(req.agent.orgId, daysFrom(req.query)));
});

// Only the chatbot reports its conversations; an agent's numbers would be made up.
const recordChatbotEvents = catchAsync(async (req, res) => {
  if (req.agent.role !== 'service') throw new ApiError(403, 'Chatbot events come from the chatbot');
  res.status(201).json(await chatbotAnalyticsService.recordEvents(req.agent.orgId, (req.body || {}).events));
});

module.exports = { getOverview, getChatbotOverview, recordChatbotEvents };
