const mongoose = require('mongoose');

const DomainSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    domainName: { type: String, required: true, trim: true, lowercase: true, maxlength: 255 },
    registrar: { type: String, required: true, trim: true, maxlength: 120 },
    dns: { type: String, default: '', trim: true, maxlength: 255 },
    sslExpiry: { type: Date, default: null },
    autoRenew: { type: Boolean, default: true },
    cost: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'USD' },
    },
    renewalDate: { type: Date, required: true, index: true },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['active', 'expiring', 'expired'], default: 'active', index: true },
    notes: { type: String, default: '', maxlength: 1000 },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Domain', DomainSchema);
