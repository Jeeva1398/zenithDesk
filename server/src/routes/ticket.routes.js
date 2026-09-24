const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const ticketController = require('../controllers/ticket.controller');
const commentController = require('../controllers/comment.controller');
const macroController = require('../controllers/macro.controller');
const attachmentController = require('../controllers/attachment.controller');
const singleUpload = require('../middlewares/singleUpload');
const { MAX_ATTACHMENT_MB } = require('../services/chatWidget.service');

const router = express.Router();

// Auth is per-route rather than router-wide, because creating a ticket is the
// one thing a service token may do, along with attaching files to the ticket
// it raised. Everything else stays agent-only.
router.post('/', authenticateAgentOrService, ticketController.createTicket);

// The chatbot forwards the files a customer attached in the widget. The
// service layer narrows what a service token may do here to the ticket it has
// just raised, under the org's own widget attachment settings.
router.post(
  '/:id/attachments',
  authenticateAgentOrService,
  singleUpload(MAX_ATTACHMENT_MB * 1024 * 1024),
  attachmentController.addAttachment,
);
router.get('/:id/attachments/:attachmentId', authenticate, attachmentController.downloadAttachment);

router.get('/', authenticate, ticketController.listTickets);
router.get('/:id', authenticate, ticketController.getTicket);
router.patch('/:id', authenticate, ticketController.updateTicket);
router.post('/:id/comments', authenticate, commentController.addComment);
router.post('/:id/apply-macro', authenticate, macroController.applyMacro);

module.exports = router;
