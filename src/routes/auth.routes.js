'use strict';

const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authLimiter } = require('../middleware/rateLimiter');
const authenticate = require('../middleware/authenticate');
const {
  registerValidation, loginValidation,
  forgotPasswordValidation, resetPasswordValidation,
} = require('../middleware/validate');

router.post('/register', authLimiter, registerValidation, ctrl.register);
router.post('/login', authLimiter, loginValidation, ctrl.login);
router.post('/refresh', ctrl.refresh);
router.post('/logout', authenticate, ctrl.logout);
router.post('/forgot-password', forgotPasswordValidation, ctrl.forgotPassword);
router.post('/reset-password', resetPasswordValidation, ctrl.resetPassword);

module.exports = router;
