const mongoose = require('mongoose');

const MemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['admin', 'member'], default: 'member' },
  },
  { _id: false }
);

const ProjectSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
    description: { type: String, default: '', maxlength: 500 },
    color: { type: String, default: '#6366F1' },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    members: { type: [MemberSchema], default: [] },
    // Optional links surfaced in the vendor/client portals (routes/portal.js)
    // — a project assigned to a vendor/client shows up in their scoped view.
    assignedVendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    assignedClient: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
  },
  { timestamps: true }
);

// Prevent duplicate members
ProjectSchema.pre('save', function (next) {
  const seen = new Set();
  this.members = this.members.filter((m) => {
    const key = String(m.user);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  next();
});

module.exports = mongoose.model('Project', ProjectSchema);
