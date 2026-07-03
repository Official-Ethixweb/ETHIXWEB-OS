const mongoose = require('mongoose');

const DepartmentSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, default: '', maxlength: 500 },
    manager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
    color: { type: String, default: '#6366F1' },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

DepartmentSchema.index({ organization: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('Department', DepartmentSchema);
