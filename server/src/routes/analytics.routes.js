const express = require('express');
const authenticate = require('../middlewares/authenticate');
const analyticsController = require('../controllers/analytics.controller');

const router = express.Router();

router.use(authenticate);

router.get('/overview', analyticsController.getOverview);

module.exports = router;
