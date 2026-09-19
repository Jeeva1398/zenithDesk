const express = require('express');
const authenticate = require('../middlewares/authenticate');
const ticketController = require('../controllers/ticket.controller');
const commentController = require('../controllers/comment.controller');
const macroController = require('../controllers/macro.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', ticketController.createTicket);
router.get('/', ticketController.listTickets);
router.get('/:id', ticketController.getTicket);
router.patch('/:id', ticketController.updateTicket);
router.post('/:id/comments', commentController.addComment);
router.post('/:id/apply-macro', macroController.applyMacro);

module.exports = router;
