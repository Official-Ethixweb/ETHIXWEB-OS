const mongoose = require('mongoose');

const AssetSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    label: { type: String, required: true, trim: true, maxlength: 120 },
    category: {
      type: String,
      enum: ['Laptop', 'Desktop', 'Monitor', 'Phone', 'Software License', 'Furniture', 'Networking', 'Other'],
      default: 'Other',
    },
    serialNumber: { type: String, default: '', trim: true, maxlength: 120 },
    vendor: { type: String, default: '', trim: true, maxlength: 120 },
    purchaseDate: { type: Date, default: null },
    warrantyExpiry: { type: Date, default: null },
    cost: {
      amount: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'USD' },
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
    status: { type: String, enum: ['available', 'in_use', 'maintenance', 'retired'], default: 'available', index: true },
    notes: { type: String, default: '', maxlength: 1000 },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Asset', AssetSchema);
