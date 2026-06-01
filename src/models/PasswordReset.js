const mongoose = require('mongoose');
const { Schema } = mongoose;

const PasswordResetSchema = new Schema({
  user:      { type: Schema.Types.ObjectId, ref: 'User', required: true },
  tokenHash: { type: String, required: true },
  expiresAt: { type: Date, required: true },
});

// TTL index — MongoDB auto-deletes expired documents
PasswordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('PasswordReset', PasswordResetSchema);
