const express = require('express');
const organizationController = require('../controllers/organization.controller');

const router = express.Router();

router.post('/signup', organizationController.signup);

module.exports = router;
