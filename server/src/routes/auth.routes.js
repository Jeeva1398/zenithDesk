const express = require('express');
const authController = require('../controllers/auth.controller');
const { loginLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/login', loginLimiter, authController.login);

// Refresh is guessing-adjacent - a valid token is a live session - so it sits
// behind the same limiter as login rather than the general one.
router.post('/refresh', loginLimiter, authController.refresh);
router.post('/logout', authController.logout);

module.exports = router;
