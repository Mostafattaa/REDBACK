'use strict';

const mongoose = require('mongoose');
const User = require('../models/User');
const Order = require('../models/Order');
const asyncHandler = require('../utils/asyncHandler');
const { successResponse } = require('../utils/apiResponse');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { hashPassword } = require('../utils/hash');

// Get current user profile
const getProfile = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user.id).select('-password -refreshTokens');
  if (!user) {
    throw new NotFoundError('User not found');
  }
  successResponse(res, { user });
});

// Update user profile
const updateProfile = asyncHandler(async (req, res) => {
  const { name, email } = req.body;
  
  const user = await User.findById(req.user.id);
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Check if email is being changed and if it's already taken
  if (email && email !== user.email) {
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ValidationError('Email already in use');
    }
    user.email = email;
  }

  if (name) user.name = name;

  await user.save();

  const updatedUser = await User.findById(user._id).select('-password -refreshTokens');
  successResponse(res, { user: updatedUser });
});

// Change password
const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.user.id).select('+password');
  if (!user) {
    throw new NotFoundError('User not found');
  }

  // Verify current password
  const bcrypt = require('bcrypt');
  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    throw new ValidationError('Current password is incorrect');
  }

  // Hash and save new password
  user.password = await hashPassword(newPassword);
  await user.save();

  successResponse(res, { message: 'Password changed successfully' });
});

// Get user dashboard data (orders, stats)
const getDashboard = asyncHandler(async (req, res) => {
  const userId = req.user.id;

  // Get user orders
  const orders = await Order.find({ user: userId })
    .populate('items.product', 'name images price')
    .sort({ createdAt: -1 })
    .limit(10);

  // Calculate stats
  const totalOrders = await Order.countDocuments({ user: userId });
  const completedOrders = await Order.countDocuments({ user: userId, status: 'delivered' });
  const pendingOrders = await Order.countDocuments({ 
    user: userId, 
    status: { $in: ['pending', 'paid', 'processing', 'shipped'] } 
  });

  // Calculate total spent
  const orderStats = await Order.aggregate([
    { $match: { user: new mongoose.Types.ObjectId(userId), status: { $ne: 'cancelled' } } },
    { $group: { _id: null, totalSpent: { $sum: '$totalAmount' } } }
  ]);

  const totalSpent = orderStats.length > 0 ? orderStats[0].totalSpent : 0;

  successResponse(res, {
    orders,
    stats: {
      totalOrders,
      completedOrders,
      pendingOrders,
      totalSpent
    }
  });
});

// Get admin dashboard data (system-wide stats)
const getAdminDashboard = asyncHandler(async (req, res) => {
  // Only admins can access this
  if (req.user.role !== 'admin') {
    throw new ValidationError('Access denied. Admin only.');
  }

  const Product = require('../models/Product');

  // Get system-wide statistics
  const totalUsers = await User.countDocuments();
  const activeUsers = await User.countDocuments({ isActive: true });
  const adminUsers = await User.countDocuments({ role: 'admin' });
  
  const totalOrders = await Order.countDocuments();
  const pendingOrders = await Order.countDocuments({ 
    status: { $in: ['pending', 'paid', 'processing'] } 
  });
  const completedOrders = await Order.countDocuments({ status: 'delivered' });
  
  const totalProducts = await Product.countDocuments();
  const lowStockProducts = await Product.countDocuments({ stock: { $lt: 10 } });

  // Calculate revenue
  const revenueStats = await Order.aggregate([
    { $match: { status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } } },
    { $group: { 
      _id: null, 
      totalRevenue: { $sum: '$totalAmount' },
      averageOrderValue: { $avg: '$totalAmount' }
    }}
  ]);

  const totalRevenue = revenueStats.length > 0 ? revenueStats[0].totalRevenue : 0;
  const averageOrderValue = revenueStats.length > 0 ? revenueStats[0].averageOrderValue : 0;

  // Get recent orders
  const recentOrders = await Order.find()
    .populate('user', 'name email')
    .populate('items.product', 'name price')
    .sort({ createdAt: -1 })
    .limit(10);

  // Get top selling products
  const topProducts = await Order.aggregate([
    { $match: { status: { $in: ['paid', 'processing', 'shipped', 'delivered'] } } },
    { $unwind: '$items' },
    { $group: {
      _id: '$items.product',
      totalSold: { $sum: '$items.quantity' },
      revenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } }
    }},
    { $sort: { totalSold: -1 } },
    { $limit: 5 },
    { $lookup: {
      from: 'products',
      localField: '_id',
      foreignField: '_id',
      as: 'productInfo'
    }},
    { $unwind: { path: '$productInfo', preserveNullAndArrays: true } }
  ]);

  successResponse(res, {
    stats: {
      users: {
        total: totalUsers,
        active: activeUsers,
        admins: adminUsers
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        completed: completedOrders
      },
      products: {
        total: totalProducts,
        lowStock: lowStockProducts
      },
      revenue: {
        total: totalRevenue,
        average: averageOrderValue
      }
    },
    recentOrders,
    topProducts
  });
});

module.exports = {
  getProfile,
  updateProfile,
  changePassword,
  getDashboard,
  getAdminDashboard
};
