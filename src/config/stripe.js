'use strict';

const Stripe = require('stripe');
const { stripeSecretKey } = require('./env');

const isPlaceholder = !stripeSecretKey || stripeSecretKey === 'sk_test_your_stripe_secret_key';
const stripe = isPlaceholder ? null : new Stripe(stripeSecretKey);

module.exports = stripe;

