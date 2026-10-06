const catchAsync = require('../utils/catchAsync');
const productService = require('../services/product.service');

// Placed after whichever authenticate middleware a route uses, since the org
// comes from the caller: an agent, the chatbot's service token, or a customer.
function requireProduct(product) {
  return catchAsync(async (req, res, next) => {
    await productService.assertHas((req.agent || req.customer).orgId, product);
    next();
  });
}

module.exports = requireProduct;
