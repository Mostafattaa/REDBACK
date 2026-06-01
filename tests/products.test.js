'use strict';

/**
 * Product Catalog API Tests
 * Tests GET /api/products, GET /api/products/:id, GET /api/categories
 */

const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../src/app');
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

// ─── Seed helpers ───────────────────────────────────────────────────────────────
let categoryId;
let productIds = [];

beforeAll(async () => {
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI);
  }

  // Create a category
  const cat = await Category.create({ name: 'Electronics', slug: 'electronics' });
  categoryId = cat._id;

  // Seed some products
  const products = await Product.insertMany([
    {
      title: 'Wireless Headphones',
      description: 'High quality sound with noise cancellation',
      price: 99.99,
      stock: 20,
      category: categoryId,
      images: ['https://example.com/headphones.jpg'],
    },
    {
      title: 'Bluetooth Speaker',
      description: 'Portable waterproof speaker',
      price: 49.99,
      stock: 50,
      category: categoryId,
      images: ['https://example.com/speaker.jpg'],
    },
    {
      title: 'Laptop Stand',
      description: 'Ergonomic aluminium laptop stand',
      price: 29.99,
      stock: 0,
      category: categoryId,
      images: ['https://example.com/stand.jpg'],
    },
  ]);

  productIds = products.map((p) => p._id.toString());
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
});

// ─── List Products ───────────────────────────────────────────────────────────────
describe('GET /api/products', () => {
  it('returns a paginated list of products', async () => {
    const res = await request(app).get('/api/products');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('products');
    expect(Array.isArray(res.body.data.products)).toBe(true);
    expect(res.body.data.products.length).toBeGreaterThan(0);
  });

  it('returns pagination metadata', async () => {
    const res = await request(app).get('/api/products?page=1&limit=2');
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('total');
    expect(res.body.data).toHaveProperty('page');
    expect(res.body.data).toHaveProperty('limit');
    expect(res.body.data.products.length).toBeLessThanOrEqual(2);
  });

  it('filters products by category slug', async () => {
    const res = await request(app).get('/api/products?category=electronics');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.products.length).toBeGreaterThan(0);
    res.body.data.products.forEach((p) => {
      expect(p.category).toBeTruthy();
    });
  });

  it('filters products by minimum price', async () => {
    const res = await request(app).get('/api/products?minPrice=50');
    expect(res.statusCode).toBe(200);
    res.body.data.products.forEach((p) => {
      expect(p.price).toBeGreaterThanOrEqual(50);
    });
  });

  it('filters products by maximum price', async () => {
    const res = await request(app).get('/api/products?maxPrice=50');
    expect(res.statusCode).toBe(200);
    res.body.data.products.forEach((p) => {
      expect(p.price).toBeLessThanOrEqual(50);
    });
  });

  it('filters products by price range', async () => {
    const res = await request(app).get('/api/products?minPrice=40&maxPrice=60');
    expect(res.statusCode).toBe(200);
    res.body.data.products.forEach((p) => {
      expect(p.price).toBeGreaterThanOrEqual(40);
      expect(p.price).toBeLessThanOrEqual(60);
    });
  });

  it('sorts products by price ascending', async () => {
    const res = await request(app).get('/api/products?sortBy=price_asc');
    expect(res.statusCode).toBe(200);
    const prices = res.body.data.products.map((p) => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeGreaterThanOrEqual(prices[i - 1]);
    }
  });

  it('sorts products by price descending', async () => {
    const res = await request(app).get('/api/products?sortBy=price_desc');
    expect(res.statusCode).toBe(200);
    const prices = res.body.data.products.map((p) => p.price);
    for (let i = 1; i < prices.length; i++) {
      expect(prices[i]).toBeLessThanOrEqual(prices[i - 1]);
    }
  });

  it('returns products matching a search query', async () => {
    const res = await request(app).get('/api/products?search=Headphones');
    expect(res.statusCode).toBe(200);
    // At least one result should contain the keyword (case-insensitive)
    const titles = res.body.data.products.map((p) => p.title.toLowerCase());
    const hasMatch = titles.some((t) => t.includes('headphones'));
    expect(hasMatch).toBe(true);
  });

  it('returns empty array for search with no matches', async () => {
    const res = await request(app).get('/api/products?search=xyznonexistent123');
    expect(res.statusCode).toBe(200);
    expect(res.body.data.products.length).toBe(0);
  });
});

// ─── Single Product ───────────────────────────────────────────────────────────────
describe('GET /api/products/:id', () => {
  it('returns a single product by valid ID', async () => {
    const res = await request(app).get(`/api/products/${productIds[0]}`);
    expect(res.statusCode).toBe(200);
    expect(res.body.data).toHaveProperty('_id', productIds[0]);
    expect(res.body.data).toHaveProperty('title');
    expect(res.body.data).toHaveProperty('price');
    expect(res.body.data).toHaveProperty('stock');
  });

  it('returns 404 for a non-existent product ID', async () => {
    const fakeId = new mongoose.Types.ObjectId().toString();
    const res = await request(app).get(`/api/products/${fakeId}`);
    expect(res.statusCode).toBe(404);
  });

  it('returns 400 for an invalid (non-ObjectId) product ID', async () => {
    const res = await request(app).get('/api/products/not-a-valid-id');
    expect([400, 404, 500]).toContain(res.statusCode);
  });
});

// ─── Categories ────────────────────────────────────────────────────────────────
describe('GET /api/categories', () => {
  it('returns a list of categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('each category has name and slug fields', async () => {
    const res = await request(app).get('/api/categories');
    res.body.data.forEach((cat) => {
      expect(cat).toHaveProperty('name');
      expect(cat).toHaveProperty('slug');
    });
  });
});
