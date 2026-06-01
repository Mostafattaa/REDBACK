'use strict';

const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const PasswordReset = require('../models/PasswordReset');
const { hashPassword, comparePassword } = require('../utils/hash');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../utils/jwt');
const { ConflictError, UnauthorizedError, NotFoundError, ValidationError } = require('../utils/errors');
const config = require('../config/env');

// Create nodemailer transporter
const transporter = nodemailer.createTransport({
  host: config.emailHost,
  port: config.emailPort,
  auth: { user: config.emailUser, pass: config.emailPass },
});

const register = async (name, email, password) => {
  const existing = await User.findOne({ email });
  if (existing) throw new ConflictError('Email already registered');

  const hashed = await hashPassword(password);
  const user = await User.create({ name, email, password: hashed, role: 'customer' });

  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
};

const login = async (email, password) => {
  const user = await User.findOne({ email }).select('+password');
  if (!user) throw new UnauthorizedError('Invalid credentials');

  const valid = await comparePassword(password, user.password);
  if (!valid) throw new UnauthorizedError('Invalid credentials');

  if (!user.isActive) throw new UnauthorizedError('Account is deactivated');

  const payload = { id: user._id.toString(), role: user.role };
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // Store hashed refresh token
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  user.refreshTokens.push({ tokenHash, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  // Keep only last 5 refresh tokens
  if (user.refreshTokens.length > 5) user.refreshTokens = user.refreshTokens.slice(-5);
  await user.save();

  return {
    accessToken,
    refreshToken,
    user: { id: user._id, name: user.name, email: user.email, role: user.role },
  };
};

const refreshAccessToken = async (refreshToken) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  const user = await User.findById(decoded.id);
  if (!user) throw new UnauthorizedError('User not found');

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  const stored = user.refreshTokens.find((t) => t.tokenHash === tokenHash);
  if (!stored) throw new UnauthorizedError('Refresh token has been revoked');

  const accessToken = signAccessToken({ id: user._id.toString(), role: user.role });
  return { accessToken };
};

const logout = async (userId, refreshToken) => {
  const user = await User.findById(userId);
  if (!user) return;

  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  user.refreshTokens = user.refreshTokens.filter((t) => t.tokenHash !== tokenHash);
  await user.save();
};

const forgotPassword = async (email) => {
  const user = await User.findOne({ email });
  // Always return 200 — don't reveal if email exists
  if (!user) return;

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await PasswordReset.deleteMany({ user: user._id });
  await PasswordReset.create({ user: user._id, tokenHash, expiresAt });

  const resetUrl = `${config.corsOrigin}/reset-password?token=${token}`;

  try {
    await transporter.sendMail({
      from: config.emailFrom,
      to: email,
      subject: 'Password Reset Request',
      html: `<p>Click <a href="${resetUrl}">here</a> to reset your password. This link expires in 1 hour.</p>`,
    });
  } catch (err) {
    console.error('Email send error:', err.message);
  }
};

const resetPassword = async (token, newPassword) => {
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await PasswordReset.findOne({ tokenHash, expiresAt: { $gt: new Date() } });

  if (!record) throw new ValidationError('Reset token is invalid or has expired');

  const hashed = await hashPassword(newPassword);
  await User.findByIdAndUpdate(record.user, { password: hashed });
  await PasswordReset.deleteOne({ _id: record._id });
};

module.exports = { register, login, refreshAccessToken, logout, forgotPassword, resetPassword };
