const express = require('express');
const mongoose = require('mongoose');
const { z } = require('zod');
const Attendance = require('../models/Attendance');
const Employee = require('../models/Employee');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['superadmin', 'owner', 'hr', 'manager'];

const listQuerySchema = z.object({
  employee: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
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

const summaryQuerySchema = z.object({ days: z.coerce.number().int().min(1).max(90).optional() });

// --- Dashboard: daily trend + attendance/leave % over the last N days ---
router.get('/summary', validate(summaryQuerySchema, 'query'), async (req, res, next) => {
  try {
    const days = Math.min(90, Math.max(1, Number(req.query.days) || 14));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const rows = await Attendance.aggregate([
      { $match: { organization: new mongoose.Types.ObjectId(req.organizationId), date: { $gte: since } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
          leave: { $sum: { $cond: [{ $eq: ['$status', 'leave'] }, 1, 0] } },
          holiday: { $sum: { $cond: [{ $eq: ['$status', 'holiday'] }, 1, 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const totals = rows.reduce(
      (acc, r) => ({
        present: acc.present + r.present,
        absent: acc.absent + r.absent,
        leave: acc.leave + r.leave,
        holiday: acc.holiday + r.holiday,
      }),
      { present: 0, absent: 0, leave: 0, holiday: 0 }
    );
    const marked = totals.present + totals.absent + totals.leave;
    const attendancePct = marked > 0 ? Math.round((totals.present / marked) * 100) : 0;
    const leavePct = marked > 0 ? Math.round((totals.leave / marked) * 100) : 0;

    return ok(res, {
      trend: rows.map((r) => ({ date: r._id, present: r.present, absent: r.absent, leave: r.leave, holiday: r.holiday })),
      totals,
      attendancePct,
      leavePct,
    });
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
