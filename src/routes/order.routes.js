'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/order.controller');
const authenticate = require('../middleware/authenticate');
const { orderValidation, objectIdParam, numericQuery } = require('../middleware/validate');

router.use(authenticate);

router.post('/', orderValidation, ctrl.createOrder);
router.get('/', numericQuery, ctrl.listOrders);
router.get('/:id', objectIdParam('id'), ctrl.getOrder);

module.exports = router;
