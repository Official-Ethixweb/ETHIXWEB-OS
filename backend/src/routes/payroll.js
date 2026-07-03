const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const { z } = require('zod');
const Payslip = require('../models/Payslip');
const Employee = require('../models/Employee');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { mountCrudExtensions, archivedFilter } = require('../utils/crudExtensions');
const { logAudit } = require('../utils/audit');
const { writeLimiter, exportLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(requireAuth);

const FINANCE_ROLES = ['superadmin', 'owner', 'finance'];

async function canViewPayslip(req, payslip) {
  if (FINANCE_ROLES.includes(req.user.companyRole)) return true;
  const employee = await Employee.findOne({ _id: payslip.employee, organization: req.organizationId }).select('user').lean();
  return !!employee?.user && String(employee.user) === req.user.id;
}

const listQuerySchema = z.object({
  employee: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  archived: z.string().optional(),
});

// --- List (self sees own, finance roles see all / filtered) ---
router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { employee, month } = req.query;
    const filter = { organization: req.organizationId, archived: archivedFilter(req) };
    if (month) filter.month = month;

    if (FINANCE_ROLES.includes(req.user.companyRole)) {
      if (employee) filter.employee = employee;
    } else {
      const myEmployee = await Employee.findOne({ user: req.user.id, organization: req.organizationId }).select('_id').lean();
      if (!myEmployee) return ok(res, { payslips: [] });
      filter.employee = myEmployee._id;
    }

    const payslips = await Payslip.find(filter).sort({ month: -1 }).populate('employee', 'name employeeId department').lean();
    return ok(res, { payslips });
  } catch (e) { next(e); }
});

const trendQuerySchema = z.object({ months: z.coerce.number().int().min(1).max(24).optional() });

// --- Dashboard: net pay + base salary totals per month, last N months ---
router.get('/trend', requireCompanyRole(FINANCE_ROLES), validate(trendQuerySchema, 'query'), async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(1, Number(req.query.months) || 12));
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setMonth(since.getMonth() - (months - 1));
    const sinceMonth = `${since.getFullYear()}-${String(since.getMonth() + 1).padStart(2, '0')}`;

    const rows = await Payslip.aggregate([
      {
        $match: {
          organization: new mongoose.Types.ObjectId(req.organizationId),
          archived: { $ne: true },
          month: { $gte: sinceMonth },
        },
      },
      {
        $group: {
          _id: '$month',
          netPay: { $sum: '$netPay' },
          baseSalary: { $sum: '$baseSalary' },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return ok(res, { trend: rows.map((r) => ({ month: r._id, netPay: r.netPay, baseSalary: r.baseSalary })) });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const payslip = await Payslip.findOne({ _id: req.params.id, organization: req.organizationId }).populate('employee', 'name employeeId department designation');
    if (!payslip) throw new ApiError('Payslip not found', 404);
    if (!(await canViewPayslip(req, payslip))) throw new ApiError('You do not have permission to view this payslip', 403);
    return ok(res, { payslip });
  } catch (e) { next(e); }
});

const generateSchema = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'month must be YYYY-MM') });

// --- Bulk-generate payslips for all active employees for a month (idempotent) ---
router.post('/generate', writeLimiter, requireCompanyRole(FINANCE_ROLES), validate(generateSchema), async (req, res, next) => {
  try {
    const { month } = req.body;
    const employees = await Employee.find({ status: 'active', organization: req.organizationId }).lean();
    let created = 0;
    let skipped = 0;
    for (const employee of employees) {
      const existing = await Payslip.findOne({ employee: employee._id, month });
      if (existing) { skipped++; continue; }
      await Payslip.create({
        organization: req.organizationId,
        employee: employee._id,
        month,
        baseSalary: employee.salary?.amount || 0,
        currency: employee.salary?.currency || 'INR',
        generatedBy: req.user.id,
      });
      created++;
    }
    const payslips = await Payslip.find({ month, organization: req.organizationId }).populate('employee', 'name employeeId department').lean();
    await logAudit(req, 'payroll.generate', 'Payslip', null, { month, created, skipped });
    return ok(res, { payslips, created, skipped }, `Generated ${created} payslip(s) for ${month}`);
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  bonuses: z.array(z.object({ label: z.string().min(1).max(80), amount: z.number().min(0) })).optional(),
  deductions: z.array(z.object({ label: z.string().min(1).max(80), amount: z.number().min(0) })).optional(),
  paymentStatus: z.enum(['pending', 'paid']).optional(),
});

router.patch('/:id', requireCompanyRole(FINANCE_ROLES), validate(updateSchema), async (req, res, next) => {
  try {
    const payslip = await Payslip.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!payslip) throw new ApiError('Payslip not found', 404);
    Object.assign(payslip, req.body);
    if (req.body.paymentStatus === 'paid' && !payslip.paidAt) payslip.paidAt = new Date();
    await payslip.save();
    return ok(res, { payslip }, 'Payslip updated');
  } catch (e) { next(e); }
});

router.post('/:id/mark-paid', requireCompanyRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const payslip = await Payslip.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!payslip) throw new ApiError('Payslip not found', 404);
    payslip.paymentStatus = 'paid';
    payslip.paidAt = new Date();
    await payslip.save();
    await logAudit(req, 'payroll.mark_paid', 'Payslip', payslip._id, { month: payslip.month, netPay: payslip.netPay });
    return ok(res, { payslip }, 'Marked as paid');
  } catch (e) { next(e); }
});

router.delete('/:id', requireCompanyRole(FINANCE_ROLES), async (req, res, next) => {
  try {
    const payslip = await Payslip.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!payslip) throw new ApiError('Payslip not found', 404);
    await logAudit(req, 'payroll.delete', 'Payslip', payslip._id, { month: payslip.month });
    return ok(res, null, 'Payslip deleted');
  } catch (e) { next(e); }
});

// --- PDF payslip ---
router.get('/:id/pdf', exportLimiter, async (req, res, next) => {
  try {
    const payslip = await Payslip.findOne({ _id: req.params.id, organization: req.organizationId }).populate('employee', 'name employeeId department designation');
    if (!payslip) throw new ApiError('Payslip not found', 404);
    if (!(await canViewPayslip(req, payslip))) throw new ApiError('You do not have permission to view this payslip', 403);

    const emp = payslip.employee;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="payslip-${emp.employeeId}-${payslip.month}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).fillColor('#8A181C').text('ETHIXWEB', { continued: true }).fillColor('#000').text(' Payslip');
    doc.moveDown(0.5);
    doc.fontSize(10).fillColor('#555').text(`Pay period: ${payslip.month}`);
    doc.moveDown(1.5);

    doc.fontSize(12).fillColor('#000').text(`Employee: ${emp.name} (${emp.employeeId})`);
    doc.text(`Designation: ${emp.designation}`);
    doc.text(`Department: ${emp.department}`);
    doc.moveDown(1);

    doc.fontSize(13).text('Earnings', { underline: true });
    doc.fontSize(11).text(`Base Salary: ${payslip.currency} ${payslip.baseSalary.toLocaleString()}`);
    payslip.bonuses.forEach((b) => doc.text(`${b.label}: ${payslip.currency} ${b.amount.toLocaleString()}`));
    doc.moveDown(0.5);
    doc.fontSize(13).text('Deductions', { underline: true });
    if (payslip.deductions.length === 0) doc.fontSize(11).text('None');
    payslip.deductions.forEach((d) => doc.fontSize(11).text(`${d.label}: -${payslip.currency} ${d.amount.toLocaleString()}`));

    doc.moveDown(1);
    doc.fontSize(14).fillColor('#8A181C').text(`Net Pay: ${payslip.currency} ${payslip.netPay.toLocaleString()}`);
    doc.moveDown(1);
    doc.fontSize(10).fillColor('#888').text(`Status: ${payslip.paymentStatus}${payslip.paidAt ? ` (paid ${new Date(payslip.paidAt).toDateString()})` : ''}`);

    doc.end();
  } catch (e) { next(e); }
});

mountCrudExtensions(router, {
  Model: Payslip,
  requireCompanyRole,
  manageRoles: FINANCE_ROLES,
  patchSchema: updateSchema.partial(),
  resourceName: 'Payslip',
});

module.exports = router;
