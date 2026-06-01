'use strict';

/**
 * Admin Dashboard API Tests
 * Tests all /api/admin endpoints with role-based access control checks.
 * Covers: user management, product CRUD, order management, overview stats.
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const User = require('../src/models/User');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

// ─── Shared state ─────────────────────────────────────────────────────────────────
let adminToken;
let customerToken;
let customerId;
let seededProductId;
let createdProductId;
let seededOrderId;

// ─── Setup ────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  // Create admin user directly in DB (bypass registration role lock)
  const bcrypt = require('bcryptjs');
  const hash = await bcrypt.hash('AdminPass123!', 10);
  const admin = await User.create({
    name: 'Admin User',
    email: `admin_${Date.now()}@example.com`,
    password: hash,
    role: 'admin',
    isActive: true,
  });

  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: 'AdminPass123!' });
  adminToken = adminLogin.body.data.accessToken;

  // Create regular customer
  const custEmail = `customer_${Date.now()}@example.com`;
  const custRes = await request(app).post('/api/auth/register').send({
    name: 'Customer',
    email: custEmail,
    password: 'CustPass123!',
  });
  const custLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: custEmail, password: 'CustPass123!' });
  customerToken = custLogin.body.data.accessToken;
  customerId = custRes.body.data.user._id || custRes.body.data.user.id;

  // Seed a product
  const cat = await Category.create({ name: 'Tools', slug: 'tools' });
  const prod = await Product.create({
    title: 'Power Drill',
    description: 'Heavy duty power drill',
    price: 89.99,
    stock: 15,
    category: cat._id,
    images: ['https://example.com/drill.jpg'],
  });
  seededProductId = prod._id.toString();
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
});

// ─── Role Protection ───────────────────────────────────────────────────────────────
describe('Admin route access control', () => {
  it('returns 401 when no token is provided', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.statusCode).toBe(401);
  });

  it('returns 403 when a customer tries to access admin routes', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.statusCode).toBe(403);
  });

  it('grants access to admin users', async () => {
    const res = await request(app)
      .get('/api/admin/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });
});

// ─── User Management ──────────────────────────────────────────────────────────────
describe('GET /api/admin/users', () => {
  it('returns paginated list of users', async () => {
    const res = await request(app)
      .get('/api/admin/users?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('users');
    expect(Array.isArray(res.body.data.users)).toBe(true);
    expect(res.body.data).toHaveProperty('total');
  });

  it('returns users matching a search query', async () => {
    const res = await request(app)
      .get('/api/admin/users?search=Admin')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.users.length).toBeGreaterThan(0);
  });
});

describe('PUT /api/admin/users/:id/role', () => {
  it('changes a user role from customer to admin', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${customerId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.role).toBe('admin');
  });

  it('changes a user role back to customer', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${customerId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'customer' });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.role).toBe('customer');
  });

  it('returns 400 for an invalid role value', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${customerId}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'superuser' });
    expect(res.statusCode).toBe(400);
  });
});

// ─── Product CRUD ─────────────────────────────────────────────────────────────────
describe('POST /api/admin/products', () => {
  it('creates a new product as admin', async () => {
    const cat = await Category.findOne({ slug: 'tools' });
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Cordless Screwdriver',
        description: 'Compact and lightweight cordless screwdriver',
        price: 45.00,
        stock: 25,
        category: cat._id.toString(),
        images: ['https://example.com/screwdriver.jpg'],
      });
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('_id');
    expect(res.body.data.title).toBe('Cordless Screwdriver');
    createdProductId = res.body.data._id;
  });

  it('returns 400 when title is missing', async () => {
    const cat = await Category.findOne({ slug: 'tools' });
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        description: 'No title product',
        price: 10,
        stock: 5,
        category: cat._id.toString(),
      });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when price is negative', async () => {
    const cat = await Category.findOne({ slug: 'tools' });
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Invalid Product',
        description: 'Should fail',
        price: -5,
        stock: 5,
        category: cat._id.toString(),
      });
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 when a customer tries to create a product', async () => {
    const cat = await Category.findOne({ slug: 'tools' });
    const res = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        title: 'Sneaky Product',
        description: 'Should be forbidden',
        price: 10,
        stock: 1,
        category: cat._id.toString(),
      });
    expect(res.statusCode).toBe(403);
  });
});

describe('PUT /api/admin/products/:id', () => {
  it('updates an existing product', async () => {
    expect(createdProductId).toBeTruthy();
    const res = await request(app)
      .put(`/api/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 42.50, stock: 30 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.price).toBe(42.50);
    expect(res.body.data.stock).toBe(30);
  });

  it('returns 404 for a non-existent product', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .put(`/api/admin/products/${fakeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price: 10 });
    expect(res.statusCode).toBe(404);
  });
});

describe('DELETE /api/admin/products/:id', () => {
  it('deletes a product as admin', async () => {
    expect(createdProductId).toBeTruthy();
    const res = await request(app)
      .delete(`/api/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
  });

  it('returns 404 when deleting an already deleted product', async () => {
    const res = await request(app)
      .delete(`/api/admin/products/${createdProductId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(404);
  });
});

// ─── Order Management ─────────────────────────────────────────────────────────────
describe('GET /api/admin/orders', () => {
  it('returns all orders with pagination', async () => {
    const res = await request(app)
      .get('/api/admin/orders?page=1&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('orders');
    expect(res.body.data).toHaveProperty('total');
    expect(Array.isArray(res.body.data.orders)).toBe(true);
  });
});

describe('Admin dashboard stats', () => {
  it('GET /api/admin/stats returns overview numbers', async () => {
    const res = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('totalUsers');
    expect(res.body.data).toHaveProperty('totalProducts');
    expect(res.body.data).toHaveProperty('totalOrders');
    expect(res.body.data).toHaveProperty('totalRevenue');
  });
});
