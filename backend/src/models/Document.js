const mongoose = require('mongoose');

// Files shared with a vendor or client via their portal — distinct from
// Employee.documents (HR paperwork) and finance/subscription attachments,
// which are internal-only and never exposed through routes/portal.js.
const DocumentSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null, index: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'Vendor', default: null, index: true },
    client: { type: mongoose.Schema.Types.ObjectId, ref: 'Client', default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 200 },
    url: { type: String, required: true },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Document', DocumentSchema);
