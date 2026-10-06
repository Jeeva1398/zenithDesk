const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/requireAdmin');
const organizationController = require('../controllers/organization.controller');
const { signupLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/signup', signupLimiter, organizationController.signup);

router.get('/me', authenticate, organizationController.getMine);
// Any admin may add the other product; there is nothing to pay yet.
router.post('/me/products', authenticate, requireAdmin, organizationController.enableProduct);

module.exports = router;
