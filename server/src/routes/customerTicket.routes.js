const express = require('express');
const authenticateCustomer = require('../middlewares/authenticateCustomer');
const customerTicketController = require('../controllers/customerTicket.controller');

const router = express.Router();

router.use(authenticateCustomer);

router.get('/tickets', customerTicketController.listMyTickets);
router.post('/tickets', customerTicketController.createMyTicket);
router.get('/tickets/:id', customerTicketController.getMyTicket);
router.post('/tickets/:id/comments', customerTicketController.addMyComment);

module.exports = router;
