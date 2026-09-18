const express = require('express');
const organizationController = require('../controllers/organization.controller');
const { authLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/signup', authLimiter, organizationController.signup);

module.exports = router;
