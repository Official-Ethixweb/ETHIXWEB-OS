const mongoose = require('mongoose');

const ClientSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    company: { type: String, default: '', trim: true, maxlength: 120 },
    email: { type: String, default: '', trim: true, lowercase: true, maxlength: 255 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    address: { type: String, default: '', trim: true, maxlength: 500 },
    status: { type: String, enum: ['active', 'inactive', 'prospect'], default: 'active', index: true },
    contractValue: {
      amount: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD' },
    },
    accountManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    notes: { type: String, default: '', maxlength: 1000 },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', ClientSchema);
