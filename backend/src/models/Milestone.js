const mongoose = require('mongoose');

// Client-facing project milestones with an approval workflow — the client
// portal's "Approvals" surface (approvals.manage permission) acts on
// approvalStatus.
const MilestoneSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    dueDate: { type: Date, default: null },
    status: { type: String, enum: ['pending', 'in_progress', 'completed'], default: 'pending' },
    approvalStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Milestone', MilestoneSchema);
