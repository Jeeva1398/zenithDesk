const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/requireAdmin');
const chatWidgetController = require('../controllers/chatWidget.controller');
const { widgetConfigLimiter } = require('../middlewares/rateLimiters');
const requireProduct = require('../middlewares/requireProduct');
const authenticateAgentOrService = require('../middlewares/authenticateService');

const router = express.Router();

// Unauthenticated on purpose: the chatbot looks a widget up by the key in the
// embed snippet before it knows anything else. Everything it returns ends up
// on the customer's public pages anyway, so nothing here is secret - the
// limiter is only there to make key-guessing pointless.
router.get('/public/:key', widgetConfigLimiter, chatWidgetController.getPublicConfig);

// Any agent may see how the widget is set up; only an admin may change it.
router.get('/', authenticate, requireProduct('chat'), chatWidgetController.getSettings);
router.patch('/', authenticate, requireProduct('chat'), requireAdmin, chatWidgetController.updateSettings);
router.get('/setup', authenticate, requireProduct('chat'), chatWidgetController.getSetup);
router.post('/regenerate-key', authenticate, requireProduct('chat'), requireAdmin, chatWidgetController.regenerateKey);

// The chat server reporting a page that loaded the widget, for the setup
// checklist's "Installed" step.
router.post('/seen', authenticateAgentOrService, requireProduct('chat'), chatWidgetController.recordSeen);

module.exports = router;
