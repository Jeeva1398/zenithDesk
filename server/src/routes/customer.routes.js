const express = require('express');
const authenticate = require('../middlewares/authenticate');
const customerController = require('../controllers/customer.controller');

const router = express.Router();

router.use(authenticate);

router.get('/', customerController.listCustomers);
router.post('/', customerController.createCustomer);
router.get('/:id', customerController.getCustomer);
router.patch('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);

module.exports = router;
