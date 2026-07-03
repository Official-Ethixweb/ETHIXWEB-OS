const mongoose = require('mongoose');

const TransactionSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    type: { type: String, enum: ['income', 'expense'], required: true, index: true },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    category: {
      type: String,
      required: true,
      enum: ['Engineering', 'Design', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations', 'Support', 'Other'],
    },
    description: { type: String, required: true, trim: true, maxlength: 255 },
    date: { type: Date, required: true, index: true },
    recurring: { type: Boolean, default: false },
    attachmentUrl: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Transaction', TransactionSchema);
