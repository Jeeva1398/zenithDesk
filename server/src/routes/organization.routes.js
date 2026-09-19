const express = require('express');
const organizationController = require('../controllers/organization.controller');
const { signupLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/signup', signupLimiter, organizationController.signup);

module.exports = router;
