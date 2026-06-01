const mongoose = require('mongoose');
const { Schema } = mongoose;

const OrderItemSchema = new Schema({
  product:  { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  quantity: { type: Number, required: true, min: 1 },
  price:    { type: Number, required: true },
}, { _id: false });

const ShippingAddressSchema = new Schema({
  fullName:      { type: String, required: true },
  streetAddress: { type: String, required: true },
  city:          { type: String, required: true },
  state:         { type: String, required: true },
  postalCode:    { type: String, required: true },
  country:       { type: String, required: true },
}, { _id: false });

const OrderSchema = new Schema({
  user:            { type: Schema.Types.ObjectId, ref: 'User', required: true },
  items:           [OrderItemSchema],
  shippingAddress: { type: ShippingAddressSchema, required: true },
  paymentIntentId: { type: String, required: true },
  status:          {
    type: String,
    enum: ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'failed'],
    default: 'pending',
  },
  totalAmount:     { type: Number, required: true },
}, { timestamps: true });

OrderSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('Order', OrderSchema);
