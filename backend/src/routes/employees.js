const express = require('express');
const { z } = require('zod');
const Employee = require('../models/Employee');
const Organization = require('../models/Organization');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadPhoto, uploadDocument, publicUrlFor } = require('../middleware/upload');
const { ok, ApiError } = require('../utils/respond');
const { mountCrudExtensions, archivedFilter } = require('../utils/crudExtensions');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['superadmin', 'owner', 'hr'];

async function nextEmployeeId(organizationId) {
  const org = await Organization.findByIdAndUpdate(
    organizationId,
    { $inc: { employeeIdSeq: 1 } },
    { new: true }
  );
  return `EW-${String(org.employeeIdSeq).padStart(4, '0')}`;
}

// --- Directory (read-only for everyone authenticated) ---
router.get('/', async (req, res, next) => {
  try {
    const { department, status, q } = req.query;
    const filter = { organization: req.organizationId, archived: archivedFilter(req) };
    if (department) filter.department = department;
    if (status) filter.status = status;
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { email: re }, { designation: re }];
    }
    const employees = await Employee.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, { employees }, 'Employees fetched');
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, organization: req.organizationId }).lean();
    if (!employee) throw new ApiError('Employee not found', 404);
    return ok(res, { employee });
  } catch (e) { next(e); }
});

const createSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.string().trim().toLowerCase().email().max(255),
  phone: z.string().max(30).optional().default(''),
  department: z.enum(['Engineering', 'Design', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations', 'Support']),
  designation: z.string().trim().min(1).max(80),
  employmentType: z.enum(['full_time', 'part_time', 'contract', 'intern']).optional().default('full_time'),
  companyRole: z
    .enum(['superadmin', 'owner', 'hr', 'finance', 'manager', 'developer', 'designer', 'qa', 'employee', 'viewer'])
    .optional()
    .default('employee'),
  joiningDate: z.string().datetime(),
  dateOfBirth: z.string().datetime().nullable().optional(),
  status: z.enum(['active', 'on_leave', 'resigned', 'terminated']).optional().default('active'),
  salary: z.object({ amount: z.number().min(0), currency: z.string().optional().default('INR') }).optional(),
  skills: z.array(z.string()).optional().default([]),
  experienceYears: z.number().min(0).optional().default(0),
  notes: z.string().max(2000).optional().default(''),
});

router.post('/', requireCompanyRole(HR_ROLES), validate(createSchema), async (req, res, next) => {
  try {
    const employeeId = await nextEmployeeId(req.organizationId);
    const employee = await Employee.create({ ...req.body, employeeId, organization: req.organizationId });
    return ok(res, { employee }, 'Employee created', 201);
  } catch (e) { next(e); }
});

const updateSchema = createSchema.partial().extend({
  bankDetails: z
    .object({ accountNumber: z.string().optional(), ifsc: z.string().optional(), upi: z.string().optional() })
    .optional(),
  emergencyContact: z
    .object({ name: z.string().optional(), phone: z.string().optional(), relation: z.string().optional() })
    .optional(),
});

router.patch('/:id', requireCompanyRole(HR_ROLES), validate(updateSchema), async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!employee) throw new ApiError('Employee not found', 404);

    if (req.body.salary && typeof req.body.salary.amount === 'number' && req.body.salary.amount !== employee.salary?.amount) {
      employee.salaryHistory.push({
        amount: req.body.salary.amount,
        effectiveDate: new Date(),
        reason: 'Salary updated',
      });
    }

    Object.assign(employee, req.body);
    await employee.save();
    return ok(res, { employee }, 'Employee updated');
  } catch (e) { next(e); }
});

router.delete('/:id', requireCompanyRole(HR_ROLES), async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!employee) throw new ApiError('Employee not found', 404);
    await Employee.deleteOne({ _id: employee._id });
    return ok(res, null, 'Employee deleted');
  } catch (e) { next(e); }
});

router.post('/:id/photo', requireCompanyRole(HR_ROLES), uploadPhoto.single('photo'), async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!employee) throw new ApiError('Employee not found', 404);
    if (!req.file) throw new ApiError('photo file is required', 400);
    employee.photoUrl = publicUrlFor(req, req.file.path);
    await employee.save();
    return ok(res, { employee }, 'Photo updated');
  } catch (e) { next(e); }
});

router.post('/:id/documents', requireCompanyRole(HR_ROLES), uploadDocument.single('document'), async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!employee) throw new ApiError('Employee not found', 404);
    if (!req.file) throw new ApiError('document file is required', 400);
    const type = req.body.type || 'Document';
    employee.documents.push({ type, url: publicUrlFor(req, req.file.path), uploadedAt: new Date() });
    await employee.save();
    return ok(res, { employee }, 'Document uploaded');
  } catch (e) { next(e); }
});

mountCrudExtensions(router, {
  Model: Employee,
  requireCompanyRole,
  manageRoles: HR_ROLES,
  patchSchema: updateSchema,
  resourceName: 'Employee',
  beforeDuplicate: async (obj, _attempt, req) => {
    obj.employeeId = await nextEmployeeId(req.organizationId);
    obj.user = null; // a duplicate is a new HR record, not a second account for the same person
    obj.name = `Copy of ${obj.name}`;
    obj.email = '';
    obj.documents = [];
    obj.photoUrl = '';
    return obj;
  },
});

module.exports = router;
module.exports.nextEmployeeId = nextEmployeeId;
