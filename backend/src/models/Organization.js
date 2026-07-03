const mongoose = require('mongoose');

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
  },
  { timestamps: true }
);

module.exports = mongoose.model('Organization', OrganizationSchema);
