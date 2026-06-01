const mongoose = require('mongoose');
const { AppError } = require('../utils/errors');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let code = err.code || 'INTERNAL_ERROR';
  let message = err.message || 'Internal server error';
  let details = err.details || null;

  // Mongoose CastError (invalid ObjectId)
  if (err.name === 'CastError') {
    statusCode = 400;
    code = 'INVALID_ID';
    message = `Invalid ${err.path}: ${err.value}`;
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    statusCode = 409;
    code = 'CONFLICT';
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `${field} already exists`;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    code = 'INVALID_TOKEN';
    message = 'Invalid token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    code = 'TOKEN_EXPIRED';
    message = 'Token has expired';
  }

  // Stripe signature error
  if (err.type === 'StripeSignatureVerificationError') {
    statusCode = 400;
    code = 'INVALID_WEBHOOK_SIGNATURE';
    message = 'Webhook signature verification failed';
  }

  const isProd = process.env.NODE_ENV === 'production';

  const body = {
    success: false,
    error: { code, message },
  };

  if (details) body.error.details = details;
  if (!isProd && err.stack) body.error.stack = err.stack;

  return res.status(statusCode).json(body);
};

module.exports = errorHandler;
