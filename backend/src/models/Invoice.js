const mongoose = require('mongoose');

// Client-facing (billed to a client) or vendor-facing (billed by a vendor)
// invoice, surfaced in the respective portal. Distinct from Payslip/Transaction,
// which are internal-only.
const InvoiceSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    number: { type: String, required: true, trim: true, maxlength: 60 },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD' },
    status: { type: String, enum: ['draft', 'sent', 'paid', 'overdue'], default: 'draft', index: true },
    dueDate: { type: Date, required: true },
    fileUrl: { type: String, default: '' },
    notes: { type: String, default: '', maxlength: 1000 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', InvoiceSchema);
