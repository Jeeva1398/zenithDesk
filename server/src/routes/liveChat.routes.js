const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const liveChatController = require('../controllers/liveChat.controller');
const { liveChatLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.use(liveChatLimiter);

// The chatbot's service token reaches four things here, all for one visitor's
// own conversation: open it, say something in it, read the replies, end it.
// Listing and joining chats is for agents only.
router.post('/', authenticateAgentOrService, liveChatController.openChat);
router.get('/', authenticate, liveChatController.listChats);
router.get('/counts', authenticate, liveChatController.getCounts);
router.get('/:id', authenticate, liveChatController.getChat);
router.get('/:id/messages', authenticateAgentOrService, liveChatController.listMessages);
router.post('/:id/messages', authenticateAgentOrService, liveChatController.addMessage);
router.post('/:id/join', authenticate, liveChatController.joinChat);
router.post('/:id/close', authenticateAgentOrService, liveChatController.closeChat);

module.exports = router;
