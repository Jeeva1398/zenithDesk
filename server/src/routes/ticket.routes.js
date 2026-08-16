const express = require('express');
const authenticate = require('../middlewares/authenticate');
const ticketController = require('../controllers/ticket.controller');
const commentController = require('../controllers/comment.controller');

const router = express.Router();

router.use(authenticate);

router.post('/', ticketController.createTicket);
router.get('/', ticketController.listTickets);
router.get('/:id', ticketController.getTicket);
router.patch('/:id', ticketController.updateTicket);
router.post('/:id/comments', commentController.addComment);

module.exports = router;
