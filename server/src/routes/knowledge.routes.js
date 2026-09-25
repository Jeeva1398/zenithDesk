const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const requireAdmin = require('../middlewares/requireAdmin');
const knowledgeController = require('../controllers/knowledge.controller');

const router = express.Router();

// Search is the one thing the chatbot's service token may do here: it looks
// for an answer before offering a ticket. It is read-only and scoped to the
// token's org, and returns published articles only - the same text the
// chatbot would show the customer anyway.
router.post('/search', authenticateAgentOrService, knowledgeController.search);

// Any agent may read the articles; only an admin may change them.
router.get('/articles', authenticate, knowledgeController.listArticles);
router.post('/articles', authenticate, requireAdmin, knowledgeController.createArticle);
router.patch('/articles/:id', authenticate, requireAdmin, knowledgeController.updateArticle);
router.delete('/articles/:id', authenticate, requireAdmin, knowledgeController.deleteArticle);

module.exports = router;
