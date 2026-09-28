const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const analyticsController = require('../controllers/analytics.controller');
const { chatbotEventsLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

// The chatbot reporting what happened in its conversations. Its service token
// reaches only this; reading the numbers back is for agents.
router.post('/chatbot/events', chatbotEventsLimiter, authenticateAgentOrService, analyticsController.recordChatbotEvents);

router.use(authenticate);

router.get('/overview', analyticsController.getOverview);
router.get('/chatbot', analyticsController.getChatbotOverview);

module.exports = router;
