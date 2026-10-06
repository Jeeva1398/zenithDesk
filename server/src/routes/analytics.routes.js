const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const analyticsController = require('../controllers/analytics.controller');
const { chatbotEventsLimiter } = require('../middlewares/rateLimiters');
const requireProduct = require('../middlewares/requireProduct');

const router = express.Router();

// The chatbot reporting what happened in its conversations. Its service token
// reaches only this; reading the numbers back is for agents.
router.post('/chatbot/events', chatbotEventsLimiter, authenticateAgentOrService, requireProduct('chat'), analyticsController.recordChatbotEvents);

router.use(authenticate);

// The ticket numbers are Desk's, the chatbot's are Chat's.
router.get('/overview', requireProduct('desk'), analyticsController.getOverview);
router.get('/chatbot', requireProduct('chat'), analyticsController.getChatbotOverview);

module.exports = router;
