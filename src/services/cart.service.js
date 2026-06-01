'use strict';

const Cart = require('../models/Cart');
const Product = require('../models/Product');
const { NotFoundError } = require('../utils/errors');

const getCart = async (userId) => {
  let cart = await Cart.findOne({ user: userId }).populate('items.product', 'title price images stock slug category');
  if (!cart) {
    cart = await Cart.create({ user: userId, items: [] });
  }
  return cart;
};

const addItem = async (userId, productId, quantity) => {
  const product = await Product.findById(productId);
  if (!product) throw new NotFoundError('Product not found');

  let cart = await Cart.findOne({ user: userId });
  if (!cart) cart = await Cart.create({ user: userId, items: [] });

  const existing = cart.items.find((i) => i.product.toString() === productId.toString());
  if (existing) {
    existing.quantity += parseInt(quantity);
  } else {
    cart.items.push({ product: productId, quantity: parseInt(quantity) });
  }

  await cart.save();
  return cart.populate('items.product', 'title price images stock slug category');
};

const updateItem = async (userId, productId, quantity) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new NotFoundError('Cart not found');

  const item = cart.items.find((i) => i.product.toString() === productId.toString());
  if (!item) throw new NotFoundError('Item not found in cart');

  if (parseInt(quantity) <= 0) {
    cart.items = cart.items.filter((i) => i.product.toString() !== productId.toString());
  } else {
    item.quantity = parseInt(quantity);
  }

  await cart.save();
  return cart.populate('items.product', 'title price images stock slug category');
};

const removeItem = async (userId, productId) => {
  const cart = await Cart.findOne({ user: userId });
  if (!cart) throw new NotFoundError('Cart not found');

  cart.items = cart.items.filter((i) => i.product.toString() !== productId.toString());
  await cart.save();
  return cart.populate('items.product', 'title price images stock slug category');
};

const clearCart = async (userId) => {
  const cart = await Cart.findOneAndUpdate(
    { user: userId },
    { items: [] },
    { new: true, upsert: true }
  );
  return cart;
};

module.exports = { getCart, addItem, updateItem, removeItem, clearCart };
