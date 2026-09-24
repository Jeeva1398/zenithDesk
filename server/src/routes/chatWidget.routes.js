const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/requireAdmin');
const chatWidgetController = require('../controllers/chatWidget.controller');
const { widgetConfigLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

// Unauthenticated on purpose: the chatbot looks a widget up by the key in the
// embed snippet before it knows anything else. Everything it returns ends up
// on the customer's public pages anyway, so nothing here is secret - the
// limiter is only there to make key-guessing pointless.
router.get('/public/:key', widgetConfigLimiter, chatWidgetController.getPublicConfig);

// Any agent may see how the widget is set up; only an admin may change it.
router.get('/', authenticate, chatWidgetController.getSettings);
router.patch('/', authenticate, requireAdmin, chatWidgetController.updateSettings);
router.post('/regenerate-key', authenticate, requireAdmin, chatWidgetController.regenerateKey);

module.exports = router;
