const mongoose = require('mongoose');

module.exports = async function globalTeardown() {
  await mongoose.disconnect();

  if (global.__MONGOD__) {
    await global.__MONGOD__.stop();
  }
};
