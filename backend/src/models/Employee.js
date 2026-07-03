const mongoose = require('mongoose');

const DocumentSchema = new mongoose.Schema(
  { type: { type: String, required: true }, url: { type: String, required: true }, uploadedAt: { type: Date, default: Date.now } },
  { _id: false }
);

const SalaryHistorySchema = new mongoose.Schema(
  { amount: { type: Number, required: true }, effectiveDate: { type: Date, required: true }, reason: { type: String, default: '' } },
  { _id: false }
);

const AssetSchema = new mongoose.Schema(
  { type: { type: String, required: true }, label: { type: String, required: true }, assignedDate: { type: Date, default: Date.now } },
  { _id: false }
);

const EmployeeSchema = new mongoose.Schema(
  {
    organization: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true, index: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    employeeId: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 255 },
    phone: { type: String, default: '', trim: true, maxlength: 30 },
    photoUrl: { type: String, default: '' },
    department: {
      type: String,
      required: true,
      enum: ['Engineering', 'Design', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations', 'Support'],
    },
    designation: { type: String, required: true, trim: true, maxlength: 80 },
    employmentType: { type: String, enum: ['full_time', 'part_time', 'contract', 'intern'], default: 'full_time' },
    companyRole: {
      type: String,
      enum: ['superadmin', 'owner', 'hr', 'finance', 'manager', 'developer', 'designer', 'qa', 'employee', 'viewer'],
      default: 'employee',
    },
    joiningDate: { type: Date, required: true },
    dateOfBirth: { type: Date, default: null },
    status: { type: String, enum: ['active', 'on_leave', 'resigned', 'terminated'], default: 'active', index: true },
    salary: {
      amount: { type: Number, default: 0 },
      currency: { type: String, default: 'INR' },
    },
    salaryHistory: { type: [SalaryHistorySchema], default: [] },
    bankDetails: {
      accountNumber: { type: String, default: '' },
      ifsc: { type: String, default: '' },
      upi: { type: String, default: '' },
    },
    documents: { type: [DocumentSchema], default: [] },
    emergencyContact: {
      name: { type: String, default: '' },
      phone: { type: String, default: '' },
      relation: { type: String, default: '' },
    },
    skills: { type: [String], default: [] },
    assignedAssets: { type: [AssetSchema], default: [] },
    notes: { type: String, default: '', maxlength: 2000 },
    experienceYears: { type: Number, default: 0 },
    archived: { type: Boolean, default: false, index: true },
    archivedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

EmployeeSchema.index({ organization: 1, employeeId: 1 }, { unique: true });

module.exports = mongoose.model('Employee', EmployeeSchema);
