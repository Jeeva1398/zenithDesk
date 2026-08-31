const express = require('express');
const customerAuthController = require('../controllers/customerAuth.controller');

const router = express.Router();

router.post('/request-otp', customerAuthController.requestOtp);
router.post('/verify-otp', customerAuthController.verifyOtp);

module.exports = router;
