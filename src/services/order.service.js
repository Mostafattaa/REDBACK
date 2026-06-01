'use strict';

const Order = require('../models/Order');
const Cart = require('../models/Cart');
const Product = require('../models/Product');
const stripe = require('../config/stripe');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');

const createOrder = async (userId, shippingAddress, paymentMethodId, requestItems) => {
  let items = [];

  if (requestItems && requestItems.length > 0) {
    // Fetch products from database to ensure correct prices and prevent frontend tampering
    const productIds = requestItems.map(item => item.product);
    const dbProducts = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(dbProducts.map(p => [p._id.toString(), p]));

    items = requestItems.map((item) => {
      const dbProduct = productMap.get(item.product.toString());
      if (!dbProduct) {
        throw new ValidationError(`Product ${item.product} not found`);
      }
      return {
        product: dbProduct._id,
        quantity: item.quantity,
        price: dbProduct.price,
      };
    });
  } else {
    // Fall back to database cart
    const cart = await Cart.findOne({ user: userId }).populate('items.product');
    if (!cart || cart.items.length === 0) {
      throw new ValidationError('Cart is empty');
    }

    items = cart.items.map((item) => ({
      product: item.product._id,
      quantity: item.quantity,
      price: item.product.price,
    }));
  }

  if (items.length === 0) {
    throw new ValidationError('Cart is empty');
  }

  const totalAmount = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  let paymentIntentId = `pi_mock_${Date.now()}`;
  let clientSecret = `pi_mock_secret_${Date.now()}`;
  let isMockPayment = true;

  if (stripe) {
    try {
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(totalAmount * 100),
        currency: 'usd',
        payment_method: paymentMethodId,
        confirm: false,
      });
      paymentIntentId = paymentIntent.id;
      clientSecret = paymentIntent.client_secret;
      isMockPayment = false;
    } catch (err) {
      console.error('Stripe error:', err.message);
    }
  }

  const order = await Order.create({
    user: userId,
    items,
    shippingAddress,
    paymentIntentId,
    status: isMockPayment ? 'paid' : 'pending',
    totalAmount,
  });

  // If it's a mock payment, decrement the product stock immediately
  if (isMockPayment) {
    for (const item of items) {
      await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
    }
  }

  await Cart.findOneAndUpdate({ user: userId }, { items: [] });

  return { order, clientSecret };
};

const handlePaymentSuccess = async (paymentIntentId) => {
  const order = await Order.findOne({ paymentIntentId });
  if (!order) return null;
  if (order.status === 'paid') return order;

  order.status = 'paid';
  await order.save();

  for (const item of order.items) {
    await Product.findByIdAndUpdate(item.product, { $inc: { stock: -item.quantity } });
  }

  return order;
};

const handlePaymentFailure = async (paymentIntentId) => {
  const order = await Order.findOneAndUpdate(
    { paymentIntentId },
    { status: 'failed' },
    { new: true }
  );
  return order;
};

const listUserOrders = async (userId, pagination = {}) => {
  const { page = 1, limit = 10 } = pagination;
  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [orders, total] = await Promise.all([
    Order.find({ user: userId })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('items.product', 'title images price'),
    Order.countDocuments({ user: userId }),
  ]);

  return { orders, total, page: parseInt(page), limit: parseInt(limit) };
};

const getOrderById = async (orderId, userId) => {
  const order = await Order.findById(orderId).populate('items.product', 'title images price');
  if (!order) throw new NotFoundError('Order not found');
  if (order.user.toString() !== userId.toString()) throw new ForbiddenError('Access denied');
  return order;
};

module.exports = { createOrder, handlePaymentSuccess, handlePaymentFailure, listUserOrders, getOrderById };
