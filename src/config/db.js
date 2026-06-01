'use strict';

const mongoose = require('mongoose');
const { mongoUri } = require('./env');

// Keep track of connection promise in serverless memory context
let cachedConnectionPromise = null;

const connectDB = async () => {
  // 1. Check if we already have an active database connection
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  // 2. If a connection is already in progress, await it
  if (cachedConnectionPromise) {
    return cachedConnectionPromise;
  }

  try {
    cachedConnectionPromise = mongoose.connect(mongoUri, {
      minPoolSize: 1, // Keep pool small for serverless execution
      maxPoolSize: 5,
    });
    const conn = await cachedConnectionPromise;
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    cachedConnectionPromise = null;
    // Don't call process.exit(1) in a serverless function as it kills the environment instance
    throw err;
  }
};

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB disconnected');
});

mongoose.connection.on('reconnected', () => {
  console.info('MongoDB reconnected');
});

module.exports = connectDB;

