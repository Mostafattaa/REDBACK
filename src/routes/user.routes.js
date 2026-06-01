'use strict';

const express = require('express');
const router = express.Router();
const userController = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const { runValidation } = require('../middleware/validate');
const { body } = require('express-validator');

// All routes require authentication
router.use(authenticate);

// Get current user profile
router.get('/profile', userController.getProfile);

// Update user profile
router.put('/profile', [
  body('name').optional().trim().notEmpty().withMessage('Name cannot be empty'),
  body('email').optional().isEmail().withMessage('Invalid email format'),
  runValidation
], userController.updateProfile);

// Change password
router.put('/password', [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters'),
  runValidation
], userController.changePassword);

// Get user dashboard data
router.get('/dashboard', userController.getDashboard);

// Get admin dashboard data (admin only)
router.get('/admin/dashboard', userController.getAdminDashboard);

module.exports = router;
