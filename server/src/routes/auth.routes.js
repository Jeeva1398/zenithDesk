const express = require('express');
const authController = require('../controllers/auth.controller');
const { authLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/login', authLimiter, authController.login);

module.exports = router;
