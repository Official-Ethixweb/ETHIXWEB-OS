const express = require('express');
const { z } = require('zod');
const LeaveRequest = require('../models/LeaveRequest');
const Employee = require('../models/Employee');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['superadmin', 'owner', 'hr', 'manager'];

const listQuerySchema = z.object({
  employee: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
});

router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { employee, status } = req.query;
    const filter = { organization: req.organizationId };
    if (employee) filter.employee = employee;
    if (status) filter.status = status;
    const leaves = await LeaveRequest.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, { leaves });
  } catch (e) { next(e); }
});

const createSchema = z.object({
  employee: z.string().min(1),
  type: z.enum(['sick', 'casual', 'earned', 'unpaid', 'other']).optional().default('casual'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  reason: z.string().max(500).optional().default(''),
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const employee = await Employee.findOne({ _id: req.body.employee, organization: req.organizationId }).lean();
    if (!employee) throw new ApiError('Employee not found', 404);

    const isSelf = employee.user && String(employee.user) === req.user.id;
    const isHR = HR_ROLES.includes(req.user.companyRole);
    if (!isSelf && !isHR) throw new ApiError('You can only request leave for yourself', 403);

    const leave = await LeaveRequest.create({ ...req.body, organization: req.organizationId });
    return ok(res, { leave }, 'Leave requested', 201);
  } catch (e) { next(e); }
});

const reviewSchema = z.object({ status: z.enum(['approved', 'rejected']) });

router.patch('/:id', requireCompanyRole(HR_ROLES), validate(reviewSchema), async (req, res, next) => {
  try {
    const leave = await LeaveRequest.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!leave) throw new ApiError('Leave request not found', 404);
    leave.status = req.body.status;
    leave.reviewedBy = req.user.id;
    await leave.save();
    return ok(res, { leave }, 'Leave request updated');
  } catch (e) { next(e); }
});

module.exports = router;
