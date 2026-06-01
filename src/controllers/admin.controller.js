'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const productService = require('../services/product.service');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { NotFoundError } = require('../utils/errors');

// Users
const listUsers = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';
  const skip = (page - 1) * limit;

  const query = {};
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { email: { $regex: search, $options: 'i' } },
    ];
  }

  const [users, total] = await Promise.all([
    User.find(query).select('-password -refreshTokens').skip(skip).limit(limit).lean(),
    User.countDocuments(query),
  ]);
  successResponse(res, users, 200, { page, limit, total });
});

const getUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id).select('-password -refreshTokens').lean();
  if (!user) throw new NotFoundError('User not found');
  successResponse(res, user);
});

const updateUserRole = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(
    req.params.id,
    { role: req.body.role },
    { new: true, runValidators: true }
  ).select('-password -refreshTokens');
  if (!user) throw new NotFoundError('User not found');
  successResponse(res, user);
});

const deactivateUser = asyncHandler(async (req, res) => {
  const user = await User.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true }).select('-password -refreshTokens');
  if (!user) throw new NotFoundError('User not found');
  successResponse(res, { message: 'User deactivated', user });
});

// Products
const createProduct = asyncHandler(async (req, res) => {
  const product = await productService.createProduct(req.body);
  successResponse(res, product, 201);
});

const updateProduct = asyncHandler(async (req, res) => {
  const product = await productService.updateProduct(req.params.id, req.body);
  successResponse(res, product);
});

const deleteProduct = asyncHandler(async (req, res) => {
  await productService.deleteProduct(req.params.id);
  successResponse(res, { message: 'Product deleted successfully' });
});

// Orders
const listAllOrders = asyncHandler(async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;
  const search = req.query.search || '';
  const skip = (page - 1) * limit;

  let query = {};
  if (search) {
    const statusMatch = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'].includes(search.toLowerCase());
    if (statusMatch) {
      query.status = search.toLowerCase();
    } else if (mongoose.Types.ObjectId.isValid(search)) {
      query._id = search;
    } else {
      const matchingUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      }).select('_id');
      const userIds = matchingUsers.map(u => u._id);

      const orQuery = [
        { user: { $in: userIds } },
        { paymentIntentId: { $regex: search, $options: 'i' } }
      ];

      if (/^[0-9a-fA-F]{24}$/.test(search)) {
        orQuery.push({ _id: search });
      }

      query.$or = orQuery;
    }
  }

  const [orders, total] = await Promise.all([
    Order.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit)
      .populate('user', 'name email')
      .populate('items.product', 'title price'),
    Order.countDocuments(query),
  ]);
  successResponse(res, orders, 200, { page, limit, total });
});

const getOrderAdmin = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('user', 'name email')
    .populate('items.product', 'title price images');
  if (!order) throw new NotFoundError('Order not found');
  successResponse(res, order);
});

const updateOrderStatus = asyncHandler(async (req, res) => {
  const order = await Order.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true, runValidators: true }
  );
  if (!order) throw new NotFoundError('Order not found');
  successResponse(res, order);
});

module.exports = {
  listUsers, getUser, updateUserRole, deactivateUser,
  createProduct, updateProduct, deleteProduct,
  listAllOrders, getOrderAdmin, updateOrderStatus,
};
