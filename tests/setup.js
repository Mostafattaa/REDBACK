const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');

module.exports = async function globalSetup() {
  const mongod = await MongoMemoryServer.create();

  process.env.NODE_ENV = 'test';
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_ACCESS_SECRET = 'test_access_secret_32_chars_long!!';
  process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_32_chars_long!';
  process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';
  process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';
  process.env.CORS_ORIGIN = 'http://localhost:5173';

  global.__MONGOD__ = mongod;
};
