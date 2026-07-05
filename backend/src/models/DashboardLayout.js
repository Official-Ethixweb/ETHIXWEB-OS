const mongoose = require('mongoose');

const LayoutItemSchema = new mongoose.Schema(
  {
    i: { type: String, required: true }, // widget instance id, e.g. "momentum" or "momentum--copy-1697040000000"
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    w: { type: Number, required: true },
    h: { type: Number, required: true },
  },
  { _id: false }
);

const DashboardLayoutSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true, index: true },
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    layout: { type: [LayoutItemSchema], default: [] },
    hiddenWidgets: { type: [String], default: [] },
  },
  { timestamps: true }
);

module.exports = mongoose.model('DashboardLayout', DashboardLayoutSchema);
