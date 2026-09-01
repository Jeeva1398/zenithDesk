const express = require('express');
const customerAuthController = require('../controllers/customerAuth.controller');

const router = express.Router();

router.post('/resolve-org', customerAuthController.resolveOrg);
router.post('/request-otp', customerAuthController.requestOtp);
router.post('/verify-otp', customerAuthController.verifyOtp);

module.exports = router;
