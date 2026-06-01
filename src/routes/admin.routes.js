'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/admin.controller');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const {
  productValidation, objectIdParam, numericQuery,
  orderStatusValidation, userRoleValidation,
} = require('../middleware/validate');

router.use(authenticate, authorize('admin'));

// Users
router.get('/users', numericQuery, ctrl.listUsers);
router.get('/users/:id', objectIdParam('id'), ctrl.getUser);
router.put('/users/:id', objectIdParam('id'), userRoleValidation, ctrl.updateUserRole);
router.delete('/users/:id', objectIdParam('id'), ctrl.deactivateUser);

// Products
router.post('/products', productValidation, ctrl.createProduct);
router.put('/products/:id', objectIdParam('id'), ctrl.updateProduct);
router.delete('/products/:id', objectIdParam('id'), ctrl.deleteProduct);

// Orders
router.get('/orders', numericQuery, ctrl.listAllOrders);
router.get('/orders/:id', objectIdParam('id'), ctrl.getOrderAdmin);
router.put('/orders/:id', objectIdParam('id'), orderStatusValidation, ctrl.updateOrderStatus);

module.exports = router;
