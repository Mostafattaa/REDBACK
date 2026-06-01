'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/product.controller');
const { numericQuery, objectIdParam } = require('../middleware/validate');

router.get('/', numericQuery, ctrl.listProducts);
router.get('/categories', ctrl.listCategories);
router.get('/:id', objectIdParam('id'), ctrl.getProduct);

module.exports = router;
