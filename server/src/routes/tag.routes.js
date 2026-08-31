const express = require('express');
const authenticate = require('../middlewares/authenticate');
const tagController = require('../controllers/tag.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', tagController.listTags);

module.exports = router;
