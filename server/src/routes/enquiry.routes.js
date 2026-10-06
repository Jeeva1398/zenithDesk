const express = require('express');
const authenticate = require('../middlewares/authenticate');
const authenticateAgentOrService = require('../middlewares/authenticateService');
const enquiryController = require('../controllers/enquiry.controller');
const requireProduct = require('../middlewares/requireProduct');

const router = express.Router();

// The chatbot's service token may add an enquiry, and nothing else here: it
// takes enquiries down, it never reads them back.
router.post('/', authenticateAgentOrService, requireProduct('chat'), enquiryController.createEnquiry);

// Any agent may work the enquiries list.
router.get('/', authenticate, requireProduct('chat'), enquiryController.listEnquiries);
router.get('/:id', authenticate, requireProduct('chat'), enquiryController.getEnquiry);
router.patch('/:id', authenticate, requireProduct('chat'), enquiryController.updateEnquiry);

module.exports = router;
