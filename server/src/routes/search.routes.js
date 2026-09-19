const express = require('express');
const authenticate = require('../middlewares/authenticate');
const searchController = require('../controllers/search.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', searchController.search);

module.exports = router;
