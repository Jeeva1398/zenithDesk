const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const ticketController = require('../controllers/ticket.controller');
const commentController = require('../controllers/comment.controller');
const macroController = require('../controllers/macro.controller');

const router = express.Router();

// Auth is per-route rather than router-wide, because creating a ticket is the
// one thing a service token may do. Everything else stays agent-only.
router.post('/', authenticateAgentOrService, ticketController.createTicket);

router.get('/', authenticate, ticketController.listTickets);
router.get('/:id', authenticate, ticketController.getTicket);
router.patch('/:id', authenticate, ticketController.updateTicket);
router.post('/:id/comments', authenticate, commentController.addComment);
router.post('/:id/apply-macro', authenticate, macroController.applyMacro);

module.exports = router;
