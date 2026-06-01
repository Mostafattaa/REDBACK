'use strict';

/**
 * Shopping Cart API Tests
 * Tests all /api/cart endpoints: view, add, update quantity, remove, clear
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

// ─── Shared state ────────────────────────────────────────────────────────────────
let accessToken;
let productId;
let cartItemId;

// ─── Setup ────────────────────────────────────────────────────────────────────────
beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  // Seed a category + product
  const cat = await Category.create({ name: 'Accessories', slug: 'accessories' });
  const product = await Product.create({
    title: 'USB-C Hub',
    description: '7-in-1 multiport adapter',
    price: 39.99,
    stock: 30,
    category: cat._id,
    images: ['https://example.com/hub.jpg'],
  });
  productId = product._id.toString();

  // Register + login a test user
  const email = `cart_user_${Date.now()}@example.com`;
  await request(app).post('/api/auth/register').send({
    name: 'Cart Tester',
    email,
    password: 'CartPass123!',
  });
  const loginRes = await request(app)
    .post('/api/auth/login')
    .send({ email, password: 'CartPass123!' });
  accessToken = loginRes.body.data.accessToken;
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
});

// ─── View Cart (empty) ────────────────────────────────────────────────────────────
describe('GET /api/cart', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app).get('/api/cart');
    expect(res.statusCode).toBe(401);
  });

  it('returns an empty cart for a new user', async () => {
    const res = await request(app)
      .get('/api/cart')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('items');
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });
});

// ─── Add to Cart ──────────────────────────────────────────────────────────────────
describe('POST /api/cart/items', () => {
  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .send({ productId, quantity: 1 });
    expect(res.statusCode).toBe(401);
  });

  it('adds an item to the cart successfully', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 2 });
    expect(res.statusCode).toBe(200);
    expect(res.body.data.items.length).toBeGreaterThan(0);

    const addedItem = res.body.data.items.find(
      (i) => i.product._id === productId || i.product === productId
    );
    expect(addedItem).toBeTruthy();
    expect(addedItem.quantity).toBe(2);
    cartItemId = addedItem._id;
  });

  it('returns 400 when productId is missing', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quantity: 1 });
    expect(res.statusCode).toBe(400);
  });

  it('returns 400 when quantity is less than 1', async () => {
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 0 });
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when productId does not exist', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId: fakeId, quantity: 1 });
    expect([400, 404]).toContain(res.statusCode);
  });
});

// ─── Update Cart Item ──────────────────────────────────────────────────────────────
describe('PUT /api/cart/items/:id', () => {
  it('updates the quantity of an existing cart item', async () => {
    expect(cartItemId).toBeTruthy();
    const res = await request(app)
      .put(`/api/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ quantity: 5 });
    expect(res.statusCode).toBe(200);
    const updatedItem = res.body.data.items.find((i) => i._id === cartItemId);
    expect(updatedItem.quantity).toBe(5);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app)
      .put(`/api/cart/items/${cartItemId}`)
      .send({ quantity: 3 });
    expect(res.statusCode).toBe(401);
  });
});

// ─── Remove from Cart ──────────────────────────────────────────────────────────────
describe('DELETE /api/cart/items/:id', () => {
  it('removes an item from the cart', async () => {
    expect(cartItemId).toBeTruthy();
    const res = await request(app)
      .delete(`/api/cart/items/${cartItemId}`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    const removedItem = res.body.data.items.find((i) => i._id === cartItemId);
    expect(removedItem).toBeUndefined();
  });
});

// ─── Clear Cart ────────────────────────────────────────────────────────────────────
describe('DELETE /api/cart', () => {
  beforeAll(async () => {
    // Re-add an item so there is something to clear
    await request(app)
      .post('/api/cart/items')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ productId, quantity: 1 });
  });

  it('clears all items from the cart', async () => {
    const res = await request(app)
      .delete('/api/cart')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data.items.length).toBe(0);
  });

  it('returns 401 without authentication', async () => {
    const res = await request(app).delete('/api/cart');
    expect(res.statusCode).toBe(401);
  });
});
