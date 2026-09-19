const catchAsync = require('../utils/catchAsync');
const searchService = require('../services/search.service');

const search = catchAsync(async (req, res) => {
  const result = await searchService.search(req.agent.orgId, {
    q: req.query.q,
    limit: req.query.limit,
  });
  res.status(200).json(result);
});

module.exports = { search };
