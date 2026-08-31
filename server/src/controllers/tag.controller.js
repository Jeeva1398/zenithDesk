const catchAsync = require('../utils/catchAsync');
const tagService = require('../services/tag.service');

const listTags = catchAsync(async (req, res) => {
  const result = await tagService.listTags(req.agent.orgId);
  res.status(200).json(result);
});

module.exports = { listTags };
