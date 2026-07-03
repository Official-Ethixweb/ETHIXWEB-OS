const mongoose = require('mongoose');

const TeamSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null, index: true },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    members: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }], default: [] },
    description: { type: String, default: '', maxlength: 500 },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

TeamSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Team', TeamSchema);
