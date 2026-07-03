const express = require('express');
const mongoose = require('mongoose');
const PDFDocument = require('pdfkit');
const { z } = require('zod');
const Transaction = require('../models/Transaction');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadDocument, uploadToBlob } = require('../middleware/upload');
const { ok, ApiError } = require('../utils/respond');
const { mountCrudExtensions, archivedFilter } = require('../utils/crudExtensions');
const { logAudit } = require('../utils/audit');
const { writeLimiter, uploadLimiter, exportLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(requireAuth);

const FINANCE_ROLES = ['superadmin', 'owner', 'finance'];

router.use(requireCompanyRole(FINANCE_ROLES));

const listQuerySchema = z.object({
  type: z.enum(['income', 'expense']).optional(),
  category: z.enum(['Engineering', 'Design', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations', 'Support', 'Other']).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  archived: z.string().optional(),
});

router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { type, category, from, to } = req.query;
    const filter = { organization: req.organizationId, archived: archivedFilter(req) };
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to) filter.date.$lte = new Date(to);
    }
    const transactions = await Transaction.find(filter).sort({ date: -1 }).lean();
    return ok(res, { transactions });
  } catch (e) { next(e); }
});

const bodySchema = z.object({
  type: z.enum(['income', 'expense']),
  amount: z.number().min(0),
  currency: z.string().optional().default('USD'),
  category: z.enum(['Engineering', 'Design', 'HR', 'Finance', 'Sales', 'Marketing', 'Operations', 'Support', 'Other']),
  description: z.string().trim().min(1).max(255),
  date: z.string().datetime(),
  recurring: z.boolean().optional().default(false),
});

router.post('/', writeLimiter, validate(bodySchema), async (req, res, next) => {
  try {
    const transaction = await Transaction.create({ ...req.body, organization: req.organizationId, createdBy: req.user.id });
    return ok(res, { transaction }, 'Transaction recorded', 201);
  } catch (e) { next(e); }
});

router.patch('/:id', writeLimiter, validate(bodySchema.partial()), async (req, res, next) => {
  try {
    const transaction = await Transaction.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId },
      req.body,
      { new: true }
    );
    if (!transaction) throw new ApiError('Transaction not found', 404);
    return ok(res, { transaction }, 'Transaction updated');
  } catch (e) { next(e); }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const transaction = await Transaction.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!transaction) throw new ApiError('Transaction not found', 404);
    await logAudit(req, 'finance.delete', 'Transaction', transaction._id, { description: transaction.description, amount: transaction.amount });
    return ok(res, null, 'Transaction deleted');
  } catch (e) { next(e); }
});

router.post('/:id/attachment', uploadLimiter, uploadDocument.single('attachment'), async (req, res, next) => {
  try {
    const transaction = await Transaction.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!transaction) throw new ApiError('Transaction not found', 404);
    if (!req.file) throw new ApiError('attachment file is required', 400);
    transaction.attachmentUrl = await uploadToBlob(req, req.file, 'attachments');
    await transaction.save();
    return ok(res, { transaction }, 'Attachment uploaded');
  } catch (e) { next(e); }
});

const summaryQuerySchema = z.object({
  month: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  year: z.string().regex(/^\d{4}$/).optional(),
});

// --- Aggregated summary: totals + category breakdown for a month or year ---
router.get('/summary', validate(summaryQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { organization: new mongoose.Types.ObjectId(req.organizationId), archived: { $ne: true } };
    if (month) {
      const [y, m] = month.split('-').map(Number);
      filter.date = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
    } else if (year) {
      filter.date = { $gte: new Date(Number(year), 0, 1), $lt: new Date(Number(year) + 1, 0, 1) };
    }

    const totals = await Transaction.aggregate([
      { $match: filter },
      { $group: { _id: '$type', total: { $sum: '$amount' } } },
    ]);
    const income = totals.find((t) => t._id === 'income')?.total || 0;
    const expense = totals.find((t) => t._id === 'expense')?.total || 0;

    const byCategory = await Transaction.aggregate([
      { $match: { ...filter, type: 'expense' } },
      { $group: { _id: '$category', total: { $sum: '$amount' } } },
      { $sort: { total: -1 } },
    ]);

    const cashFlow = await Transaction.aggregate([
      { $match: filter },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return ok(res, {
      income,
      expense,
      profit: income - expense,
      byCategory: byCategory.map((c) => ({ category: c._id, total: c.total })),
      cashFlow: cashFlow.map((c) => ({ date: c._id, income: c.income, expense: c.expense })),
    });
  } catch (e) { next(e); }
});

const trendQuerySchema = z.object({ months: z.coerce.number().int().min(1).max(24).optional() });

// --- Dashboard: income/expense totals per month, last N months ---
router.get('/trend', validate(trendQuerySchema, 'query'), async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(1, Number(req.query.months) || 12));
    const since = new Date();
    since.setDate(1);
    since.setHours(0, 0, 0, 0);
    since.setMonth(since.getMonth() - (months - 1));

    const rows = await Transaction.aggregate([
      {
        $match: {
          organization: new mongoose.Types.ObjectId(req.organizationId),
          archived: { $ne: true },
          date: { $gte: since },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m', date: '$date' } },
          income: { $sum: { $cond: [{ $eq: ['$type', 'income'] }, '$amount', 0] } },
          expense: { $sum: { $cond: [{ $eq: ['$type', 'expense'] }, '$amount', 0] } },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return ok(res, { trend: rows.map((r) => ({ month: r._id, income: r.income, expense: r.expense })) });
  } catch (e) { next(e); }
});

// --- PDF report ---
router.get('/report/pdf', exportLimiter, validate(summaryQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { month, year } = req.query;
    const filter = { organization: req.organizationId, archived: { $ne: true } };
    if (month) {
      const [y, m] = month.split('-').map(Number);
      filter.date = { $gte: new Date(y, m - 1, 1), $lt: new Date(y, m, 1) };
    } else if (year) {
      filter.date = { $gte: new Date(Number(year), 0, 1), $lt: new Date(Number(year) + 1, 0, 1) };
    }
    const transactions = await Transaction.find(filter).sort({ date: 1 }).lean();
    const income = transactions.filter((t) => t.type === 'income').reduce((s, t) => s + t.amount, 0);
    const expense = transactions.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amount, 0);

    const label = month || year || 'all-time';
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="finance-report-${label}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    doc.fontSize(20).fillColor('#8A181C').text('ETHIXWEB', { continued: true }).fillColor('#000').text(' Finance Report');
    doc.fontSize(10).fillColor('#555').text(`Period: ${label}`);
    doc.moveDown(1);
    doc.fontSize(12).fillColor('#000').text(`Income: $${income.toLocaleString()}`);
    doc.text(`Expense: $${expense.toLocaleString()}`);
    doc.fontSize(14).fillColor('#8A181C').text(`Profit: $${(income - expense).toLocaleString()}`);
    doc.moveDown(1);

    doc.fontSize(13).fillColor('#000').text('Transactions', { underline: true });
    doc.moveDown(0.3);
    transactions.forEach((t) => {
      doc.fontSize(9).fillColor(t.type === 'income' ? '#1a7f37' : '#8A181C')
        .text(`${new Date(t.date).toDateString()}  ${t.type.toUpperCase()}  ${t.category}  ${t.description}  $${t.amount.toLocaleString()}`);
    });

    doc.end();
  } catch (e) { next(e); }
});

mountCrudExtensions(router, {
  Model: Transaction,
  requireCompanyRole,
  manageRoles: FINANCE_ROLES,
  patchSchema: bodySchema.partial(),
  resourceName: 'Transaction',
  beforeDuplicate: async (obj) => {
    obj.description = `Copy of ${obj.description}`;
    obj.attachmentUrl = '';
    return obj;
  },
});

module.exports = router;
