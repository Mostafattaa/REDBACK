'use strict';

const productService = require('../services/product.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');

const listProducts = asyncHandler(async (req, res) => {
  const { page, limit, category, minPrice, maxPrice, search, sortBy } = req.query;
  const result = await productService.listProducts(
    { category, minPrice, maxPrice, search },
    { page, limit },
    sortBy
  );
  successResponse(res, result.products, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

const getProduct = asyncHandler(async (req, res) => {
  const product = await productService.getProductById(req.params.id);
  successResponse(res, product);
});

const listCategories = asyncHandler(async (req, res) => {
  const categories = await productService.listCategories();
  successResponse(res, categories);
});

module.exports = { listProducts, getProduct, listCategories };
