const express = require('express');
const authenticate = require('../middlewares/authenticate');
const macroController = require('../controllers/macro.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', macroController.listMacros);
router.post('/', macroController.createMacro);
router.patch('/:id', macroController.updateMacro);
router.delete('/:id', macroController.deleteMacro);

module.exports = router;
