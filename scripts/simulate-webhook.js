'use strict';

/**
 * Stripe Webhook Simulator
 * Exposes a developer shortcut to simulate Stripe webhook execution locally without the Stripe CLI.
 * It connects to MongoDB, finds the latest pending order, and POSTs a mock payload to the webhook endpoint.
 * Run with: npm run simulate-webhook  (or node scripts/simulate-webhook.js)
 */

require('dotenv').config();
const mongoose = require('mongoose');
const http = require('http');
const Order = require('../src/models/Order');

const MONGODB_URI = process.env.MONGODB_URI;
const PORT = process.env.PORT || 5000;

if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set in your .env file.');
  process.exit(1);
}

async function run() {
  console.log('Connecting to MongoDB...');
  await mongoose.connect(MONGODB_URI);
  console.log('✅ Connected to MongoDB.');

  // Find the latest pending order
  const order = await Order.findOne({ status: 'pending' }).sort({ createdAt: -1 });

  if (!order) {
    console.log('\n⚠️ No pending orders found in the database.');
    console.log('👉 Please add products to your cart on the frontend, complete the checkout form,');
    console.log('   and click "Complete Order" first to create a pending order.\n');
    await mongoose.disconnect();
    return;
  }

  console.log('\n==================================================');
  console.log(`📦 Found Latest Pending Order:`);
  console.log(`   Order ID:       ${order._id}`);
  console.log(`   Customer ID:    ${order.user}`);
  console.log(`   Payment Intent: ${order.paymentIntentId}`);
  console.log(`   Total Amount:   $${order.totalAmount}`);
  console.log(`   Created At:     ${order.createdAt}`);
  console.log('==================================================\n');

  // Construct the mock Stripe event payload
  const eventPayload = {
    id: `evt_mock_${Date.now()}`,
    object: 'event',
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: order.paymentIntentId,
        object: 'payment_intent',
        amount: Math.round(order.totalAmount * 100),
        currency: 'usd',
        status: 'succeeded'
      }
    }
  };

  const payloadString = JSON.stringify(eventPayload);

  console.log('🚀 Sending simulated payment_intent.succeeded webhook event to local server...');

  const options = {
    hostname: 'localhost',
    port: PORT,
    path: '/api/webhooks/stripe',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payloadString),
      'x-mock-webhook': 'true'
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', async () => {
      console.log(`📬 Webhook Endpoint Response: HTTP ${res.statusCode}`);
      console.log(`📬 Response Body: ${data}`);

      if (res.statusCode === 200) {
        console.log('\n🎉 Webhook simulator POST succeeded! Waiting 1s for database update to settle...');
        
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Re-fetch order from database to verify status change
        const updatedOrder = await Order.findById(order._id);
        console.log('\n==================================================');
        console.log(`🔄 Verification Result:`);
        console.log(`   Order ID:       ${updatedOrder._id}`);
        console.log(`   Old Status:     pending`);
        console.log(`   New Status:     "${updatedOrder.status}" (expected: "paid")`);
        console.log('==================================================');
        if (updatedOrder.status === 'paid') {
          console.log('\n✅ SUCCESS: Order status updated to "paid" and product stock levels decremented!');
        } else {
          console.log('\n❌ FAILED: Order status is still "pending". Check server terminal for route errors.');
        }
        console.log('');
      } else {
        console.log('\n❌ Webhook simulator failed. Server returned non-200 status code.');
        console.log('👉 Check your backend console logs for webhook validation errors.\n');
      }

      await mongoose.disconnect();
    });
  });

  req.on('error', async (err) => {
    console.error(`\n❌ Error connecting to local server: ${err.message}`);
    console.log('👉 Make sure your backend server is running on http://localhost:5000 before running this script!\n');
    await mongoose.disconnect();
  });

  req.write(payloadString);
  req.end();
}

run().catch((err) => {
  console.error('Simulator runtime error:', err);
  process.exit(1);
});
