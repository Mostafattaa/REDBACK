'use strict';

const { body, param, query, validationResult } = require('express-validator');
const { ValidationError } = require('../utils/errors');
const mongoose = require('mongoose');

// Run validation and forward errors
const runValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new ValidationError('Validation failed', errors.array()));
  }
  next();
};

// Auth validations
const registerValidation = [
  body('name').trim().notEmpty().withMessage('Name is required').isLength({ min: 2 }).withMessage('Name must be at least 2 characters'),
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  runValidation,
];

const loginValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  runValidation,
];

const forgotPasswordValidation = [
  body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
  runValidation,
];

const resetPasswordValidation = [
  body('token').notEmpty().withMessage('Reset token is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  runValidation,
];

// Product validations
const productValidation = [
  body('title').trim().notEmpty().withMessage('Title is required'),
  body('price').isFloat({ min: 0.01 }).withMessage('Price must be a positive number'),
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('category').custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Valid category ID is required'),
  body('stock').isInt({ min: 0 }).withMessage('Stock must be a non-negative integer'),
  runValidation,
];

// Cart validations
const cartItemValidation = [
  body('productId').custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage('Valid product ID is required'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  runValidation,
];

// Order validations
const orderValidation = [
  body('shippingAddress.fullName').trim().notEmpty().withMessage('Full name is required'),
  body('shippingAddress.streetAddress').trim().notEmpty().withMessage('Street address is required'),
  body('shippingAddress.city').trim().notEmpty().withMessage('City is required'),
  body('shippingAddress.state').trim().notEmpty().withMessage('State is required'),
  body('shippingAddress.postalCode').trim().notEmpty().withMessage('Postal code is required'),
  body('shippingAddress.country').trim().notEmpty().withMessage('Country is required'),
  body('paymentMethodId').notEmpty().withMessage('Payment method ID is required'),
  runValidation,
];

// Order status validation
const orderStatusValidation = [
  body('status').isIn(['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled']).withMessage('Invalid order status'),
  runValidation,
];

// ObjectId param validation
const objectIdParam = (paramName) => [
  param(paramName).custom((val) => mongoose.Types.ObjectId.isValid(val)).withMessage(`Invalid ${paramName}`),
  runValidation,
];

// Numeric query validation
const numericQuery = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 0, max: 1000 }).withMessage('Limit must be between 0 and 1000'),
  query('minPrice').optional().isFloat({ min: 0 }).withMessage('minPrice must be a non-negative number'),
  query('maxPrice').optional().isFloat({ min: 0 }).withMessage('maxPrice must be a non-negative number'),
  runValidation,
];

// User role validation
const userRoleValidation = [
  body('role').isIn(['customer', 'admin']).withMessage('Role must be customer or admin'),
  runValidation,
];

module.exports = {
  runValidation,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  productValidation,
  cartItemValidation,
  orderValidation,
  orderStatusValidation,
  objectIdParam,
  numericQuery,
  userRoleValidation,
};
