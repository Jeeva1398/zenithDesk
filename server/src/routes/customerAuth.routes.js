const express = require('express');
const customerAuthController = require('../controllers/customerAuth.controller');
const {
  lookupLimiter,
  otpRequestLimiter,
  otpVerifyLimiter,
} = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/resolve-org', lookupLimiter, customerAuthController.resolveOrg);
router.post('/request-otp', otpRequestLimiter, customerAuthController.requestOtp);
router.post('/verify-otp', otpVerifyLimiter, customerAuthController.verifyOtp);

module.exports = router;
