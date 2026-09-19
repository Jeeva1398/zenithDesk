const express = require('express');
const authController = require('../controllers/auth.controller');
const { loginLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/login', loginLimiter, authController.login);

module.exports = router;
