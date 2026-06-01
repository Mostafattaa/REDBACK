const mongoose = require('mongoose');
const { Schema } = mongoose;

const ProductSchema = new Schema({
  title:       { type: String, required: true, trim: true },
  slug:        { type: String, required: true, unique: true, lowercase: true, trim: true },
  price:       { type: Number, required: true, min: 0 },
  description: { type: String, required: true },
  category:    { type: Schema.Types.ObjectId, ref: 'Category', required: true },
  images:      [{ type: String }],
  stock:       { type: Number, required: true, min: 0, default: 0 },
}, { timestamps: true });

ProductSchema.index({ slug: 1 }, { unique: true });
ProductSchema.index({ title: 'text', description: 'text' });
ProductSchema.index({ category: 1, price: 1 });

module.exports = mongoose.model('Product', ProductSchema);
