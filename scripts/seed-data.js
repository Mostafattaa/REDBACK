'use strict';

/**
 * Seed script — populates products and categories from DummyJSON into MongoDB.
 * Run with: node scripts/seed-data.js
 */

require('dotenv').config();
const mongoose = require('mongoose');
const slugify = require('slugify');

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('MONGODB_URI is not set in back/.env');
  process.exit(1);
}

// Inline model definition if needed, or import existing models
const Product = require('../src/models/Product');
const Category = require('../src/models/Category');

async function seed() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to MongoDB');

  // Clear existing collections
  console.log('Clearing existing products and categories...');
  await Product.deleteMany({});
  await Category.deleteMany({});

  console.log('Fetching products from DummyJSON...');
  const res = await fetch('https://dummyjson.com/products?limit=200');
  if (!res.ok) {
    throw new Error(`Failed to fetch products: ${res.status}`);
  }
  const data = await res.json();
  const dummyProducts = data.products || [];
  console.log(`Fetched ${dummyProducts.length} products`);

  // Extract unique categories
  const categoriesMap = new Map();
  const categorySlugs = [...new Set(dummyProducts.map(p => p.category))];

  console.log('Seeding categories...');
  for (const slug of categorySlugs) {
    // Capitalize slug to use as name
    const name = slug
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');

    const category = await Category.create({
      name,
      slug: slug.toLowerCase(),
      image: ''
    });
    categoriesMap.set(slug.toLowerCase(), category._id);
  }
  console.log(`Successfully seeded ${categoriesMap.size} categories`);

  console.log('Seeding products...');
  let productCount = 0;
  for (const dp of dummyProducts) {
    const categoryId = categoriesMap.get(dp.category.toLowerCase());
    if (!categoryId) {
      console.warn(`Category not found for product: ${dp.title} (${dp.category})`);
      continue;
    }

    const title = dp.title.trim();
    const slug = slugify(title, { lower: true, strict: true });

    // Handle duplicate slug issues
    let finalSlug = slug;
    let suffix = 1;
    while (await Product.findOne({ slug: finalSlug })) {
      finalSlug = `${slug}-${suffix}`;
      suffix++;
    }

    await Product.create({
      title,
      slug: finalSlug,
      price: dp.price,
      description: dp.description,
      category: categoryId,
      images: dp.images || [dp.thumbnail],
      stock: dp.stock || 10
    });
    productCount++;
  }

  console.log(`Successfully seeded ${productCount} products`);
  await mongoose.disconnect();
  console.log('Disconnected from MongoDB. Seeding Complete!');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  mongoose.disconnect().then(() => process.exit(1));
});
