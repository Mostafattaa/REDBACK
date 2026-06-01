'use strict';

const router = require('express').Router();
const stripe = require('../config/stripe');
const orderService = require('../services/order.service');
const config = require('../config/env');

router.post(
  '/stripe',
  require('express').raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const isMock = config.nodeEnv === 'development' && req.headers['x-mock-webhook'] === 'true';

    let event;
    if (isMock) {
      try {
        const bodyStr = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : req.body;
        event = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;
        console.log(`🤖 Simulated Webhook Event Received: ${event.type}`);
      } catch (err) {
        console.error('Failed to parse simulated webhook body:', err.message);
        return res.status(400).json({ error: 'Invalid JSON payload' });
      }
    } else {
      if (!stripe || !config.stripeWebhookSecret || config.stripeWebhookSecret === 'whsec_dummy' || config.stripeWebhookSecret.startsWith('whsec_your_stripe_webhook')) {
        return res.status(200).json({ received: true, message: 'Stripe is unconfigured or using a placeholder webhook secret.' });
      }

      try {
        event = stripe.webhooks.constructEvent(req.body, sig, config.stripeWebhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return res.status(400).json({ error: 'Webhook signature verification failed' });
      }
    }

    try {
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        await orderService.handlePaymentSuccess(paymentIntent.id);
        console.log(`✅ Payment succeeded webhook processed for PaymentIntent: ${paymentIntent.id}`);
      } else if (event.type === 'payment_intent.payment_failed') {
        const paymentIntent = event.data.object;
        await orderService.handlePaymentFailure(paymentIntent.id);
        console.log(`❌ Payment failed webhook processed for PaymentIntent: ${paymentIntent.id}`);
      }
    } catch (err) {
      console.error('Webhook handler error:', err.message);
    }

    res.status(200).json({ received: true });
  }
);

module.exports = router;
