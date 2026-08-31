const catchAsync = require('../utils/catchAsync');
const customerTicketService = require('../services/customerTicket.service');

const listMyTickets = catchAsync(async (req, res) => {
  const tickets = await customerTicketService.listTickets(req.customer.orgId, req.customer.email);
  res.status(200).json({ tickets });
});

const getMyTicket = catchAsync(async (req, res) => {
  const ticket = await customerTicketService.getTicketById(req.customer.orgId, req.customer.email, req.params.id);
  res.status(200).json(ticket);
});

module.exports = { listMyTickets, getMyTicket };
