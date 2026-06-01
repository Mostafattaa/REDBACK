'use strict';

const orderService = require('../services/order.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');

const createOrder = asyncHandler(async (req, res) => {
  const { shippingAddress, paymentMethodId, items } = req.body;
  const result = await orderService.createOrder(req.user.id, shippingAddress, paymentMethodId, items);
  successResponse(res, result, 201);
});

const listOrders = asyncHandler(async (req, res) => {
  const { page, limit } = req.query;
  const result = await orderService.listUserOrders(req.user.id, { page, limit });
  successResponse(res, result.orders, 200, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

const getOrder = asyncHandler(async (req, res) => {
  const order = await orderService.getOrderById(req.params.id, req.user.id);
  successResponse(res, order);
});

module.exports = { createOrder, listOrders, getOrder };
