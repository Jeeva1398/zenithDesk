const express = require('express');
const authController = require('../controllers/auth.controller');
const { loginLimiter, passwordResetLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/login', loginLimiter, authController.login);

// Refresh is guessing-adjacent - a valid token is a live session - so it sits
// behind the same limiter as login rather than the general one.
router.post('/refresh', loginLimiter, authController.refresh);
router.post('/logout', authController.logout);

// Asking for a link sends an email, so it is held to a few per address an
// hour; using one is a guess at a token, so it shares login's limiter.
router.post('/forgot-password', passwordResetLimiter, authController.forgotPassword);
router.post('/reset-password', loginLimiter, authController.resetPassword);

module.exports = router;
