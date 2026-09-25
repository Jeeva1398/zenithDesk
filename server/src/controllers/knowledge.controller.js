const catchAsync = require('../utils/catchAsync');
const knowledgeService = require('../services/knowledge.service');

const listArticles = catchAsync(async (req, res) => {
  res.status(200).json(await knowledgeService.listArticles(req.agent.orgId));
});

const createArticle = catchAsync(async (req, res) => {
  res.status(201).json(await knowledgeService.createArticle(req.agent.orgId, req.body));
});

const updateArticle = catchAsync(async (req, res) => {
  res.status(200).json(await knowledgeService.updateArticle(req.agent.orgId, req.params.id, req.body));
});

const deleteArticle = catchAsync(async (req, res) => {
  await knowledgeService.deleteArticle(req.agent.orgId, req.params.id);
  res.status(204).end();
});

const search = catchAsync(async (req, res) => {
  res.status(200).json(await knowledgeService.search(req.agent.orgId, req.body));
});

module.exports = { listArticles, createArticle, updateArticle, deleteArticle, search };
