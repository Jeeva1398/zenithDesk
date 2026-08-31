const express = require('express');
const authenticate = require('../middlewares/authenticate');
const viewController = require('../controllers/view.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', viewController.listViews);
router.post('/', viewController.createView);
router.patch('/:id', viewController.updateView);
router.delete('/:id', viewController.deleteView);

module.exports = router;
