const express = require('express');
const authenticateSuperAdmin = require('../middlewares/authenticateSuperAdmin');
const platformController = require('../controllers/platform.controller');

const router = express.Router();

router.use(authenticateSuperAdmin);

router.get('/organizations', platformController.listOrganizations);
router.get('/agents', platformController.listAgents);
router.get('/tickets', platformController.listTickets);

module.exports = router;
