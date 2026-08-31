const express = require('express');
const authenticateCustomer = require('../middlewares/authenticateCustomer');
const customerTicketController = require('../controllers/customerTicket.controller');

const router = express.Router();

router.use(authenticateCustomer);

router.get('/tickets', customerTicketController.listMyTickets);
router.get('/tickets/:id', customerTicketController.getMyTicket);

module.exports = router;
