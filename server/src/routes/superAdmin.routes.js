const express = require('express');
const superAdminController = require('../controllers/superAdmin.controller');

const router = express.Router();

router.post('/login', superAdminController.login);

module.exports = router;
