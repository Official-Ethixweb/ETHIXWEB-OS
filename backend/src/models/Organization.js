const mongoose = require('mongoose');

// Every optional module the sidebar can show. An org that doesn't use a
// module (e.g. no physical assets to track) can turn it off for everyone,
// regardless of what any role's permissions would otherwise allow — this is
// deliberately a coarser, org-wide switch layered on top of the per-role
// permission system (see config/permissions.js), not a replacement for it.
const TOGGLEABLE_MODULES = [
  'projects', 'employees', 'departments', 'payroll', 'finance',
  'subscriptions', 'domains', 'servers', 'clients', 'vendors', 'assets',
];

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 120 },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[a-z0-9-]+$/, 'Invalid slug'],
    },
    ownerUser: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    plan: { type: String, enum: ['free', 'trial', 'paid'], default: 'free' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active', index: true },
    employeeIdSeq: { type: Number, default: 0 },
    // Optional per-org IP allowlist. Empty array = disabled (allow all).
    // Entries are exact IPs or CIDR blocks, matched in middleware/auth.js.
    ipAllowlist: { type: [String], default: [] },

    branding: {
      logoUrl: { type: String, default: '' },
      primaryColor: { type: String, default: '#8A181C', match: /^#[0-9a-fA-F]{6}$/ },
    },
    timezone: { type: String, default: 'UTC' },
    currency: { type: String, default: 'USD', uppercase: true, minlength: 3, maxlength: 3 },
    // Which optional modules this org has turned on. Defaults to all of them
    // so existing orgs (and this field being absent pre-migration) behave
    // exactly as before.
    enabledModules: { type: [String], default: TOGGLEABLE_MODULES },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', OrganizationSchema);
module.exports.TOGGLEABLE_MODULES = TOGGLEABLE_MODULES;
