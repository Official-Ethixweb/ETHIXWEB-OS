const mongoose = require('mongoose');

const SubscriptionSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    vendor: { type: String, required: true, trim: true, maxlength: 120 },
    plan: { type: String, default: '', trim: true, maxlength: 120 },
    cost: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'USD' },
    },
    billingCycle: { type: String, enum: ['monthly', 'yearly', 'weekly', 'custom'], default: 'monthly' },
    renewalDate: { type: Date, required: true, index: true },
    autoRenew: { type: Boolean, default: true },
    cardUsed: { type: String, default: '', trim: true, maxlength: 60 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    status: { type: String, enum: ['active', 'trial', 'cancelled'], default: 'active', index: true },
    invoiceUrl: { type: String, default: '' },
    notes: { type: String, default: '', maxlength: 1000 },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Subscription', SubscriptionSchema);
