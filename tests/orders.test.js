'use strict';

/**
 * Orders API Tests
 * Tests POST /api/orders (create), GET /api/orders (list user orders),
 * GET /api/orders/:id (single order), and stock decrement logic
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

// ─── Shared state ────────────────────────────────────────────────────────────────
let accessToken;
let product;
let orderId;

const INITIAL_STOCK = 10;

// ─── Valid order payload factory ──────────────────────────────────────────────────
function buildOrderPayload(overrides = {}) {
  return {
    items: [{ product: product._id.toString(), quantity: 2 }],
    shippingAddress: {
      fullName: 'Jane Doe',
      streetAddress: '123 Main St',
      city: 'Cairo',
      state: 'Cairo Governorate',
      postalCode: '11511',
      country: 'Egypt',
    },
    paymentMethodId: 'pm_card_visa',
    ...overrides,
  };
}

// ─── Setup ────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  // Seed product
  const cat = await Category.create({ name: 'Gadgets', slug: 'gadgets' });
  product = await Product.create({
    title: 'Smart Watch',
    description: 'Feature-rich smartwatch with health tracking',
    price: 199.99,
    stock: INITIAL_STOCK,
    category: cat._id,
    images: ['https://example.com/watch.jpg'],
  });

  // Register + login
  const email = `orders_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({
    name: 'Order Tester',
    email,
    password: 'OrderPass123!',
  });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'OrderPass123!' });
  accessToken = loginRes.body.data.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
});

// ─── Create Order ──────────────────────────────────────────────────────────────────
describe('POST /api/orders', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send(buildOrderPayload());
    expect(res.statusCode).toBe(401);
  });

  it('creates an order successfully', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(buildOrderPayload());

    expect(res.statusCode).toBe(201);
    expect(res.body.data).toHaveProperty('order');
    expect(res.body.data.order).toHaveProperty('_id');
    expect(res.body.data.order).toHaveProperty('status');
    expect(res.body.data.order.items.length).toBeGreaterThan(0);

    orderId = res.body.data.order._id;
  });

  it('returns 400 when items array is empty', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(buildOrderPayload({ items: [] }));
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when shippingAddress is missing', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ items: [{ product: product._id.toString(), quantity: 1 }] });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when quantity is 0', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(buildOrderPayload({
        items: [{ product: product._id.toString(), quantity: 0 }],
      }));
    expect(res.statusCode).toBe(400);
  });

  it('returns an error when ordering more than available stock', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`)
      .send(buildOrderPayload({
        items: [{ product: product._id.toString(), quantity: 9999 }],
      }));
    expect([400, 422]).toContain(res.statusCode);
  });
});

// ─── Stock Decrement ───────────────────────────────────────────────────────────────
describe('Stock sync after order (mock mode)', () => {
  it('decrements stock after a successful order in mock mode', async () => {
    // Re-fetch product from DB to check updated stock
    const updated = await Product.findById(product._id);
    // In mock mode the stock is decremented immediately upon order creation
    // The order above was for quantity: 2
    expect(updated.stock).toBe(INITIAL_STOCK - 2);
  });
});

// ─── List User Orders ─────────────────────────────────────────────────────────────
describe('GET /api/orders', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.statusCode).toBe(401);
  });

  it('returns the authenticated user\'s orders', async () => {
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });
});

// ─── Get Single Order ─────────────────────────────────────────────────────────────
describe('GET /api/orders/:id', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get(`/api/orders/${orderId}`);
    expect(res.statusCode).toBe(401);
  });

  it('returns the order by ID for the owning user', async () => {
    expect(orderId).toBeTruthy();
    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data._id).toBe(orderId);
    expect(res.body.data).toHaveProperty('shippingAddress');
    expect(res.body.data).toHaveProperty('items');
  });

  it('returns 404 for a non-existent order ID', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .get(`/api/orders/${fakeId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(404);
  });

  it('returns 403 or 404 when another user tries to access this order', async () => {
    // Create another user
    const email2 = `other_${Date.now()}@example.com`;
    await request(app).post('/api/auth/register').send({
      name: 'Other User',
      email: email2,
      password: 'OtherPass123!',
    });
    const loginRes2 = await request(app)
      .post('/api/auth/login')
      .send({ email: email2, password: 'OtherPass123!' });
    const otherToken = loginRes2.body.data.accessToken;

    const res = await request(app)
      .get(`/api/orders/${orderId}`)
      .set('Authorization', `Bearer ${otherToken}`);
    expect([403, 404]).toContain(res.statusCode);
  });
});
