'use strict';

const app = require('../src/app');
const connectDB = require('../src/config/db');

// Serverless entry wrapper
module.exports = async (req, res) => {
  // Ensure DB connection is active before handling requests
  await connectDB();
  return app(req, res);
};
