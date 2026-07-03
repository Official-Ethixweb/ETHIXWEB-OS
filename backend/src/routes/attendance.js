const express = require('express');
const { z } = require('zod');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['superadmin', 'owner', 'hr', 'manager'];

router.get('/', async (req, res, next) => {
  try {
    const { employee, from, to } = req.query;
    const filter = { organization: req.organizationId };
    if (employee) filter.employee = employee;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const records = await Attendance.find(filter).sort({ date: -1 }).lean();
    return ok(res, { attendance: records });
  } catch (e) { next(e); }
});

const markSchema = z.object({
  employee: z.string().min(1),
  date: z.string().datetime(),
  status: z.enum(['present', 'absent', 'leave', 'holiday']),
});

router.post('/', validate(markSchema), async (req, res, next) => {
  try {
    const { employee: employeeId, date, status } = req.body;
    const employee = await Employee.findOne({ _id: employeeId, organization: req.organizationId }).lean();
    if (!employee) throw new ApiError('Employee not found', 404);

    const isSelf = employee.user && String(employee.user) === req.user.id;
    const isHR = HR_ROLES.includes(req.user.companyRole);
    if (!isSelf && !isHR) throw new ApiError('You can only mark your own attendance', 403);

    const day = new Date(date);
    day.setHours(0, 0, 0, 0);

    const record = await Attendance.findOneAndUpdate(
      { employee: employeeId, date: day },
      { $set: { status }, $setOnInsert: { organization: req.organizationId } },
      { upsert: true, new: true }
    );
    return ok(res, { attendance: record }, 'Attendance marked');
  } catch (e) { next(e); }
});

module.exports = router;
