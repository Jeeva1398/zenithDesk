const express = require('express');
const authenticate = require('../middlewares/authenticate');
const tagController = require('../controllers/tag.controller');
const requireProduct = require('../middlewares/requireProduct');

const router = express.Router();

router.use(authenticate, requireProduct('desk'));

router.get('/', tagController.listTags);

module.exports = router;
