const express = require('express');
const authenticate = require('../middlewares/authenticate');
const requireAdmin = require('../middlewares/requireAdmin');
const slaController = require('../controllers/sla.controller');

const router = express.Router();

router.use(authenticate);

// Any agent may read the targets they are being measured against; only an admin
// may change them.
router.get('/policies', slaController.listPolicies);
router.patch('/policies/:id', requireAdmin, slaController.updatePolicy);

module.exports = router;
