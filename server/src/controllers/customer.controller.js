const catchAsync = require('../utils/catchAsync');
const customerService = require('../services/customer.service');

const listCustomers = catchAsync(async (req, res) => {
  const result = await customerService.listCustomers(req.agent.orgId);
  res.status(200).json(result);
});

const getCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.getCustomerById(req.agent.orgId, req.params.id);
  res.status(200).json(customer);
});

const createCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.createCustomer(req.agent.orgId, req.body);
  res.status(201).json(customer);
});

const updateCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.updateCustomer(req.agent.orgId, req.params.id, req.body);
  res.status(200).json(customer);
});

const deleteCustomer = catchAsync(async (req, res) => {
  await customerService.deleteCustomer(req.agent.orgId, req.params.id);
  res.status(204).send();
});

module.exports = { listCustomers, getCustomer, createCustomer, updateCustomer, deleteCustomer };
