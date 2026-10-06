const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const liveChatController = require('../controllers/liveChat.controller');
const { liveChatLimiter } = require('../middlewares/rateLimiters');
const requireProduct = require('../middlewares/requireProduct');

const router = express.Router();

router.use(liveChatLimiter);

// The chatbot's service token reaches four things here, all for one visitor's
// own conversation: open it, say something in it, read the replies, end it.
// Listing and joining chats is for agents only.
router.post('/', authenticateAgentOrService, requireProduct('chat'), liveChatController.openChat);
router.get('/', authenticate, requireProduct('chat'), liveChatController.listChats);
router.get('/counts', authenticate, requireProduct('chat'), liveChatController.getCounts);
router.get('/:id', authenticate, requireProduct('chat'), liveChatController.getChat);
router.get('/:id/messages', authenticateAgentOrService, requireProduct('chat'), liveChatController.listMessages);
router.post('/:id/messages', authenticateAgentOrService, requireProduct('chat'), liveChatController.addMessage);
router.post('/:id/join', authenticate, requireProduct('chat'), liveChatController.joinChat);
router.post('/:id/close', authenticateAgentOrService, requireProduct('chat'), liveChatController.closeChat);

module.exports = router;
