'use strict';

const slugify = require('slugify');
const Product = require('../models/Product');
const Category = require('../models/Category');
const cache = require('./cache.service');
const { NotFoundError } = require('../utils/errors');

const PRODUCTS_CACHE_KEY = 'products_list';
const CATEGORIES_CACHE_KEY = 'categories_list';

const listProducts = async (filters = {}, pagination = {}, sort = '') => {
  const { category, minPrice, maxPrice, search } = filters;
  const { page = 1, limit = 20 } = pagination;

  const cacheKey = `${PRODUCTS_CACHE_KEY}_${JSON.stringify({ filters, pagination, sort })}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const query = {};

  if (category) {
    const mongoose = require('mongoose');
    if (mongoose.Types.ObjectId.isValid(category)) {
      query.category = category;
    } else {
      const catObj = await Category.findOne({ slug: category });
      if (catObj) {
        query.category = catObj._id;
      } else {
        query.category = new mongoose.Types.ObjectId();
      }
    }
  }
  if (minPrice !== undefined || maxPrice !== undefined) {
    query.price = {};
    if (minPrice !== undefined) query.price.$gte = parseFloat(minPrice);
    if (maxPrice !== undefined) query.price.$lte = parseFloat(maxPrice);
  }
  if (search) {
    query.$text = { $search: search };
  }

  let sortObj = {};
  switch (sort) {
    case 'price_asc': sortObj = { price: 1 }; break;
    case 'price_desc': sortObj = { price: -1 }; break;
    case 'name_asc': sortObj = { title: 1 }; break;
    case 'name_desc': sortObj = { title: -1 }; break;
    default: sortObj = { createdAt: -1 };
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);
  const [products, total] = await Promise.all([
    Product.find(query).populate('category', 'name slug').sort(sortObj).skip(skip).limit(parseInt(limit)).lean(),
    Product.countDocuments(query),
  ]);

  // Normalize to match frontend expectations
  const normalized = products.map(normalizeProduct);
  const result = { products: normalized, total, page: parseInt(page), limit: parseInt(limit) };

  cache.set(cacheKey, result);
  return result;
};

const normalizeProduct = (product) => ({
  ...product,
  id: product._id,
  category: product.category
    ? { name: product.category.name, slug: product.category.slug, _id: product.category._id }
    : product.category,
  thumbnail: product.images && product.images[0] ? product.images[0] : '',
  rating: product.rating || 4.5,
});

const getProductById = async (id) => {
  const product = await Product.findById(id).populate('category', 'name slug').lean();
  if (!product) throw new NotFoundError('Product not found');
  return normalizeProduct(product);
};

const createProduct = async (data) => {
  const slug = slugify(data.title, { lower: true, strict: true });
  const product = await Product.create({ ...data, slug });
  cache.delPrefix(PRODUCTS_CACHE_KEY);
  // Invalidate all product list cache keys
  return normalizeProduct(product.toObject());
};

const updateProduct = async (id, data) => {
  if (data.title) data.slug = slugify(data.title, { lower: true, strict: true });
  const product = await Product.findByIdAndUpdate(id, data, { new: true, runValidators: true }).populate('category', 'name slug').lean();
  if (!product) throw new NotFoundError('Product not found');
  cache.delPrefix(PRODUCTS_CACHE_KEY);
  return normalizeProduct(product);
};

const deleteProduct = async (id) => {
  const product = await Product.findByIdAndDelete(id);
  if (!product) throw new NotFoundError('Product not found');
  cache.delPrefix(PRODUCTS_CACHE_KEY);
};

const listCategories = async () => {
  const cached = cache.get(CATEGORIES_CACHE_KEY);
  if (cached) return cached;

  const categories = await Category.find().lean();
  cache.set(CATEGORIES_CACHE_KEY, categories);
  return categories;
};

module.exports = { listProducts, getProductById, createProduct, updateProduct, deleteProduct, listCategories };
