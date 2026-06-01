'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/cart.controller');
const authenticate = require('../middleware/authenticate');
const { cartItemValidation, objectIdParam } = require('../middleware/validate');

router.use(authenticate);

router.get('/', ctrl.getCart);
router.post('/items', cartItemValidation, ctrl.addItem);
router.put('/items/:productId', objectIdParam('productId'), ctrl.updateItem);
router.delete('/items/:productId', objectIdParam('productId'), ctrl.removeItem);
router.delete('/', ctrl.clearCart);

module.exports = router;
