const jwt = require('jsonwebtoken');
const config = require('../config/env');

const signAccessToken = (payload) => {
  return jwt.sign(payload, config.jwtAccessSecret, { expiresIn: config.jwtAccessExpiry });
};

const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwtAccessSecret);
};

const signRefreshToken = (payload) => {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: config.jwtRefreshExpiry });
};

const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwtRefreshSecret);
};

module.exports = { signAccessToken, verifyAccessToken, signRefreshToken, verifyRefreshToken };
