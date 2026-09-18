const express = require('express');
const superAdminController = require('../controllers/superAdmin.controller');
const { authLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/login', authLimiter, superAdminController.login);

module.exports = router;
