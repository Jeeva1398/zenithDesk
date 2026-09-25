const catchAsync = require('../utils/catchAsync');
const enquiryService = require('../services/enquiry.service');

const createEnquiry = catchAsync(async (req, res) => {
  res.status(201).json(await enquiryService.createEnquiry(req.agent.orgId, req.body));
});

const listEnquiries = catchAsync(async (req, res) => {
  res.status(200).json(await enquiryService.listEnquiries(req.agent.orgId, req.query));
});

const getEnquiry = catchAsync(async (req, res) => {
  res.status(200).json(await enquiryService.getEnquiry(req.agent.orgId, req.params.id));
});

const updateEnquiry = catchAsync(async (req, res) => {
  res.status(200).json(await enquiryService.updateEnquiry(req.agent.orgId, req.params.id, req.body));
});

module.exports = { createEnquiry, listEnquiries, getEnquiry, updateEnquiry };
