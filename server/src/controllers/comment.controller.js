const catchAsync = require('../utils/catchAsync');
const commentService = require('../services/comment.service');

const addComment = catchAsync(async (req, res) => {
  const comment = await commentService.addComment(
    req.agent.orgId,
    req.params.id,
    req.agent.id,
    req.body.body,
  );
  res.status(201).json(comment);
});

module.exports = { addComment };
