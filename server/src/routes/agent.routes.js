const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/requireAdmin');
const agentController = require('../controllers/agent.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', agentController.listAgents);
router.post('/', requireAdmin, agentController.createAgent);

module.exports = router;
