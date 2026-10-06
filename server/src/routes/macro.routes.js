const express = require('express');
const authenticate = require('../middlewares/authenticate');
const macroController = require('../controllers/macro.controller');
const requireProduct = require('../middlewares/requireProduct');

const router = express.Router();

router.use(authenticate, requireProduct('desk'));

router.get('/', macroController.listMacros);
router.post('/', macroController.createMacro);
router.patch('/:id', macroController.updateMacro);
router.delete('/:id', macroController.deleteMacro);

module.exports = router;
