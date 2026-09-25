const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const enquiryController = require('../controllers/enquiry.controller');

const router = express.Router();

// The chatbot's service token may add an enquiry, and nothing else here: it
// takes enquiries down, it never reads them back.
router.post('/', authenticateAgentOrService, enquiryController.createEnquiry);

// Any agent may work the enquiries list.
router.get('/', authenticate, enquiryController.listEnquiries);
router.get('/:id', authenticate, enquiryController.getEnquiry);
router.patch('/:id', authenticate, enquiryController.updateEnquiry);

module.exports = router;
