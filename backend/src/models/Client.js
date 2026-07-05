const mongoose = require('mongoose');
const { CLIENT_PORTAL_KEYS } = require('../config/portalPermissions');

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

    // Portal access — a client contact can optionally sign in to a scoped
    // portal (see routes/portal.js). Disabled and empty by default.
    portalUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    portalEnabled: { type: Boolean, default: false },
    portalPermissions: {
      type: [String],
      default: [],
      validate: { validator: (arr) => arr.every((p) => CLIENT_PORTAL_KEYS.includes(p)), message: 'Unknown portal permission key' },
    },
    portalInviteTokenHash: { type: String, default: null, index: true },
    portalInviteExpires: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Client', ClientSchema);
