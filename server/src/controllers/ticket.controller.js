const catchAsync = require('../utils/catchAsync');
const ticketService = require('../services/ticket.service');

const createTicket = catchAsync(async (req, res) => {
  const ticket = await ticketService.createTicket(req.agent.orgId, req.body);
  res.status(201).json(ticket);
});

const listTickets = catchAsync(async (req, res) => {
  const result = await ticketService.listTickets(req.agent.orgId, req.query);
  res.status(200).json(result);
});

const getTicket = catchAsync(async (req, res) => {
  const ticket = await ticketService.getTicketById(req.agent.orgId, req.params.id);
  res.status(200).json(ticket);
});

const updateTicket = catchAsync(async (req, res) => {
  const ticket = await ticketService.updateTicket(req.agent.orgId, req.params.id, req.body);
  res.status(200).json(ticket);
});

module.exports = { createTicket, listTickets, getTicket, updateTicket };
