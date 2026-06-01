'use strict';

/**
 * Authentication API Tests
 * Tests all /api/auth endpoints: register, login, refresh, logout, forgot-password
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');

// ─── Helpers ───────────────────────────────────────────────────────────────────
async function registerUser(overrides = {}) {
  const payload = {
    name: 'Test User',
    email: `test_${Date.now()}@example.com`,
    password: 'Password123!',
    ...overrides,
  };
  const res = await request(app).post('/api/auth/register').send(payload);
  return { res, payload };
}

async function loginUser(email, password) {
  return request(app).post('/api/auth/login').send({ email, password });
}

// ─── Connect before tests ───────────────────────────────────────────────────────
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
});

// ─── Registration ───────────────────────────────────────────────────────────────
describe('POST /api/auth/register', () => {
  it('registers a new user successfully', async () => {
    const { res } = await registerUser();
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('user');
    expect(res.body.data.user).toHaveProperty('email');
    expect(res.body.data.user).not.toHaveProperty('password');
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'John',
      password: 'Password123!',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when password is too short', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'John',
      email: 'short@example.com',
      password: 'abc',
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 when email is already registered', async () => {
    const email = `dup_${Date.now()}@example.com`;
    await registerUser({ email });
    const { res } = await registerUser({ email });
    expect(res.statusCode).toBe(409);
  });
});

// ─── Login ──────────────────────────────────────────────────────────────────────
describe('POST /api/auth/login', () => {
  let testEmail, testPassword;

  beforeAll(async () => {
    testPassword = 'ValidPass123!';
    testEmail = `login_${Date.now()}@example.com`;
    await registerUser({ email: testEmail, password: testPassword });
  });

  it('logs in with correct credentials', async () => {
    const res = await loginUser(testEmail, testPassword);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data).toHaveProperty('refreshToken');
    expect(res.body.data.user.email).toBe(testEmail);
  });

  it('returns 401 with wrong password', async () => {
    const res = await loginUser(testEmail, 'WrongPassword!');
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 with non-existent email', async () => {
    const res = await loginUser('nobody@nowhere.com', 'Password123!');
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ password: 'abc' });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Token Refresh ───────────────────────────────────────────────────────────────
describe('POST /api/auth/refresh', () => {
  let refreshToken;

  beforeAll(async () => {
    const email = `refresh_${Date.now()}@example.com`;
    await registerUser({ email });
    const res = await loginUser(email, 'Password123!');
    refreshToken = res.body.data.refreshToken;
  });

  it('returns a new access token with a valid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('accessToken');
  });

  it('returns 401 with an invalid refresh token', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: 'totally-fake-token' });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Logout ─────────────────────────────────────────────────────────────────────
describe('POST /api/auth/logout', () => {
  it('logs out successfully with a valid refresh token', async () => {
    const email = `logout_${Date.now()}@example.com`;
    await registerUser({ email });
    const loginRes = await loginUser(email, 'Password123!');
    const { refreshToken } = loginRes.body.data;

    const res = await request(app)
      .post('/api/auth/logout')
      .send({ refreshToken });
    expect(res.statusCode).toBe(200);

    // Token should no longer work after logout
    const retryRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken });
    expect(retryRes.statusCode).toBe(401);
  });
});

// ─── Forgot Password ─────────────────────────────────────────────────────────────
describe('POST /api/auth/forgot-password', () => {
  it('returns 200 (even for non-existent email) to prevent user enumeration', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'noone@nowhere.com' });
    expect(res.statusCode).toBe(200);
  });

  it('returns 400 when email format is invalid', async () => {
    const res = await request(app)
      .post('/api/auth/forgot-password')
      .send({ email: 'not-an-email' });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Protected Routes ─────────────────────────────────────────────────────────────
describe('Protected route access', () => {
  it('returns 401 when accessing protected route without token', async () => {
    const res = await request(app).get('/api/users/profile');
    expect(res.statusCode).toBe(401);
  });

  it('returns 401 when using a malformed Bearer token', async () => {
    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', 'Bearer this-is-not-a-jwt');
    expect(res.statusCode).toBe(401);
  });

  it('returns profile data with a valid access token', async () => {
    const email = `profile_${Date.now()}@example.com`;
    await registerUser({ email });
    const loginRes = await loginUser(email, 'Password123!');
    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/users/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.email).toBe(email);
  });
});
