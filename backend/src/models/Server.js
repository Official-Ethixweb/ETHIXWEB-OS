const mongoose = require('mongoose');

const UsageSchema = new mongoose.Schema(
  { used: { type: Number, default: 0 }, total: { type: Number, default: 0 }, unit: { type: String, default: 'GB' } },
  { _id: false }
);

const ServerSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    provider: {
      type: String,
      enum: ['Railway', 'Vercel', 'Render', 'AWS', 'Azure', 'GCP', 'DigitalOcean', 'VPS', 'Other'],
      required: true,
    },
    hostingType: { type: String, default: '', trim: true, maxlength: 80 },
    storage: { type: UsageSchema, default: () => ({}) },
    bandwidth: { type: UsageSchema, default: () => ({}) },
    cost: {
      amount: { type: Number, required: true, min: 0 },
      currency: { type: String, default: 'USD' },
    },
    renewalDate: { type: Date, required: true, index: true },
    status: { type: String, enum: ['online', 'offline', 'degraded'], default: 'online', index: true },
    lastCheckedAt: { type: Date, default: Date.now },
    notes: { type: String, default: '', maxlength: 1000 },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Server', ServerSchema);
