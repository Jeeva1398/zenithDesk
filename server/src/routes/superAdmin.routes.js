const express = require('express');
const superAdminController = require('../controllers/superAdmin.controller');
const { loginLimiter } = require('../middlewares/rateLimiters');

const router = express.Router();

router.post('/login', loginLimiter, superAdminController.login);

module.exports = router;
