const mongoose = require('mongoose');

const LineItemSchema = new mongoose.Schema(
  { label: { type: String, required: true, trim: true, maxlength: 80 }, amount: { type: Number, required: true, min: 0 } },
  { _id: false }
);

const PayslipSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/, index: true }, // "YYYY-MM"
    baseSalary: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'INR' },
    bonuses: { type: [LineItemSchema], default: [] },
    deductions: { type: [LineItemSchema], default: [] },
    grossPay: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ['pending', 'paid'], default: 'pending', index: true },
    paidAt: { type: Date, default: null },
    generatedAt: { type: Date, default: Date.now },
    generatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PayslipSchema.index({ employee: 1, month: 1 }, { unique: true });

PayslipSchema.pre('save', function (next) {
  const bonusTotal = this.bonuses.reduce((sum, b) => sum + b.amount, 0);
  const deductionTotal = this.deductions.reduce((sum, d) => sum + d.amount, 0);
  this.grossPay = this.baseSalary + bonusTotal;
  this.netPay = this.grossPay - deductionTotal;
  next();
});

module.exports = mongoose.model('Payslip', PayslipSchema);
