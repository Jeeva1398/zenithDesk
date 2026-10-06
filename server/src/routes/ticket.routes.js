const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const ticketController = require('../controllers/ticket.controller');
const commentController = require('../controllers/comment.controller');
const macroController = require('../controllers/macro.controller');
const attachmentController = require('../controllers/attachment.controller');
const singleUpload = require('../middlewares/singleUpload');
const { MAX_ATTACHMENT_MB } = require('../services/chatWidget.service');
const requireProduct = require('../middlewares/requireProduct');

const router = express.Router();

// Auth is per-route rather than router-wide, because creating a ticket is the
// one thing a service token may do, along with attaching files to the ticket
// it raised. Everything else stays agent-only.
router.post('/', authenticateAgentOrService, requireProduct('desk'), ticketController.createTicket);

// The chatbot forwards the files a customer attached in the widget. The
// service layer narrows what a service token may do here to the ticket it has
// just raised, under the org's own widget attachment settings.
router.post(
  '/:id/attachments',
  authenticateAgentOrService,
  requireProduct('desk'),
  singleUpload(MAX_ATTACHMENT_MB * 1024 * 1024),
  attachmentController.addAttachment,
);
router.get('/:id/attachments/:attachmentId', authenticate, requireProduct('desk'), attachmentController.downloadAttachment);

router.get('/', authenticate, requireProduct('desk'), ticketController.listTickets);
router.get('/:id', authenticate, requireProduct('desk'), ticketController.getTicket);
router.patch('/:id', authenticate, requireProduct('desk'), ticketController.updateTicket);
router.post('/:id/comments', authenticate, requireProduct('desk'), commentController.addComment);
router.post('/:id/apply-macro', authenticate, requireProduct('desk'), macroController.applyMacro);

module.exports = router;
