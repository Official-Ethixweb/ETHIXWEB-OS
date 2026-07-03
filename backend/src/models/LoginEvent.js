const mongoose = require('mongoose');

const LoginEventSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    success: { type: Boolean, required: true },
    reason: { type: String, default: null }, // e.g. 'bad_password' | 'locked' | 'ok'
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

LoginEventSchema.index({ user: 1, createdAt: -1 });

module.exports = mongoose.model('LoginEvent', LoginEventSchema);
