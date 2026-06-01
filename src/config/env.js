'use strict';

// dotenv is loaded by server.js before this module is required.
// In test mode, env vars are set by tests/setup.js.

if (process.env.NODE_ENV !== 'test') {
  const required = ['MONGODB_URI', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'];
  const missing = required.filter((k) => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

module.exports = {
  nodeEnv:             process.env.NODE_ENV             || 'development',
  port:                parseInt(process.env.PORT, 10)   || 5000,
  mongoUri:            process.env.MONGODB_URI,
  jwtAccessSecret:     process.env.JWT_ACCESS_SECRET,
  jwtRefreshSecret:    process.env.JWT_REFRESH_SECRET,
  jwtAccessExpiry:     process.env.JWT_ACCESS_EXPIRY    || '15m',
  jwtRefreshExpiry:    process.env.JWT_REFRESH_EXPIRY   || '7d',
  stripeSecretKey:     process.env.STRIPE_SECRET_KEY    || '',
  stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  corsOrigin:          process.env.CORS_ORIGIN          || 'http://localhost:5173',
  emailHost:           process.env.EMAIL_HOST           || 'smtp.ethereal.email',
  emailPort:           parseInt(process.env.EMAIL_PORT, 10) || 587,
  emailUser:           process.env.EMAIL_USER           || '',
  emailPass:           process.env.EMAIL_PASS           || '',
  emailFrom:           process.env.EMAIL_FROM           || 'noreply@redline.com',
};
