const mongoose = require('mongoose');
const { Schema } = mongoose;

const CategorySchema = new Schema({
  name:  { type: String, required: true, trim: true },
  slug:  { type: String, required: true, unique: true, lowercase: true, trim: true },
  image: { type: String, default: '' },
});

CategorySchema.index({ slug: 1 }, { unique: true });

module.exports = mongoose.model('Category', CategorySchema);
