const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const Vendor = require('../models/Vendor');
const Client = require('../models/Client');
const Project = require('../models/Project');
const Task = require('../models/Task');
const Document = require('../models/Document');
const Invoice = require('../models/Invoice');
const Milestone = require('../models/Milestone');
const User = require('../models/User');
const { requirePortalAuth, requirePortalPermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { logAudit } = require('../utils/audit');
const { accountLimiter } = require('../middleware/rateLimit');
const { streamBlobByKey } = require('../utils/blobStream');

const router = express.Router();

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// --- Public: invite preview + acceptance (mirrors the staff invite flow in routes/invites.js) ---

const previewQuerySchema = z.object({ type: z.enum(['vendor', 'client']), token: z.string().min(1) });

router.get('/invite/preview', validate(previewQuerySchema, 'query'), async (req, res, next) => {
  try {
    const Model = req.query.type === 'vendor' ? Vendor : Client;
    const record = await Model.findOne({ portalInviteTokenHash: hashToken(req.query.token) }).populate('organization', 'name');
    if (!record || !record.portalInviteExpires || record.portalInviteExpires < new Date()) {
      throw new ApiError('This invite link is invalid or has expired', 404);
    }
    return ok(res, { name: record.name, email: record.email, type: req.query.type });
  } catch (e) { next(e); }
});

const acceptSchema = z.object({
  type: z.enum(['vendor', 'client']),
  token: z.string().min(1),
  name: z.string().trim().min(2).max(80),
  password: z.string().min(6).max(100),
});

router.post('/invite/accept', accountLimiter, validate(acceptSchema), async (req, res, next) => {
  try {
    const Model = req.body.type === 'vendor' ? Vendor : Client;
    const record = await Model.findOne({ portalInviteTokenHash: hashToken(req.body.token) });
    if (!record || !record.portalInviteExpires || record.portalInviteExpires < new Date()) {
      throw new ApiError('This invite link is invalid or has expired', 404);
    }
    if (record.portalUser) throw new ApiError('This invite has already been used', 409);

    const existing = await User.findOne({ email: record.email });
    if (existing) throw new ApiError('An account with this email already exists', 409);

    const passwordHash = await User.hashPassword(req.body.password);
    const user = await User.create({
      organization: record.organization,
      name: req.body.name,
      email: record.email,
      passwordHash,
      userType: req.body.type,
      companyRole: 'viewer',
    });

    record.portalUser = user._id;
    record.portalEnabled = true;
    record.portalInviteTokenHash = null;
    record.portalInviteExpires = null;
    await record.save();

    return ok(res, null, 'Portal account created — you can now sign in', 201);
  } catch (e) { next(e); }
});

// --- Portal-side data access ---

router.use(requirePortalAuth);

async function loadPortalRecord(req) {
  const Model = req.portal.type === 'vendor' ? Vendor : Client;
  return Model.findById(req.portal.recordId);
}

router.get('/me', async (req, res, next) => {
  try {
    const record = await loadPortalRecord(req);
    if (!record) throw new ApiError('Not found', 404);
    return ok(res, {
      id: req.user.id,
      type: req.portal.type,
      name: record.name,
      email: record.email,
      permissions: req.portal.permissions,
      organizationName: req.user.organizationName,
    });
  } catch (e) { next(e); }
});

router.get('/projects', async (req, res, next) => {
  try {
    const requiredPermission = req.portal.type === 'vendor' ? 'projects.view_assigned' : 'progress.view';
    if (!req.portal.permissions.includes(requiredPermission)) {
      throw new ApiError('You do not have permission to view this', 403);
    }
    const filterKey = req.portal.type === 'vendor' ? 'assignedVendor' : 'assignedClient';
    const projects = await Project.find({ organization: req.organizationId, [filterKey]: req.portal.recordId })
      .select('name description color createdAt')
      .lean();

    const projectIds = projects.map((p) => p._id);
    const tasks = await Task.find({ project: { $in: projectIds } }).select('project status').lean();
    const withProgress = projects.map((p) => {
      const pTasks = tasks.filter((t) => String(t.project) === String(p._id));
      const done = pTasks.filter((t) => t.status === 'done').length;
      return { ...p, taskCount: pTasks.length, doneCount: done, progressPct: pTasks.length ? Math.round((done / pTasks.length) * 100) : 0 };
    });
    return ok(res, { projects: withProgress });
  } catch (e) { next(e); }
});

router.get('/tasks', requirePortalPermission('tasks.view_assigned'), async (req, res, next) => {
  try {
    if (req.portal.type !== 'vendor') throw new ApiError('Not found', 404);
    const projects = await Project.find({ organization: req.organizationId, assignedVendor: req.portal.recordId }).select('_id name color').lean();
    const projectIds = projects.map((p) => p._id);
    const tasks = await Task.find({ project: { $in: projectIds } }).sort({ status: 1, order: 1 }).lean();
    const projectById = new Map(projects.map((p) => [String(p._id), p]));
    return ok(res, { tasks: tasks.map((t) => ({ ...t, projectName: projectById.get(String(t.project))?.name, projectColor: projectById.get(String(t.project))?.color })) });
  } catch (e) { next(e); }
});

router.get('/documents', requirePortalPermission('documents.view'), async (req, res, next) => {
  try {
    const filter = { organization: req.organizationId, [req.portal.type]: req.portal.recordId };
    const documents = await Document.find(filter).sort({ createdAt: -1 }).populate('uploadedBy', 'name').lean();
    return ok(res, { documents });
  } catch (e) { next(e); }
});

// Documents are shared with a specific vendor/client, but the storage proxy
// (/files/*) is internal-staff-only (see routes/files.js) — this route is
// the portal-side equivalent, scoping the download to a Document record the
// caller was actually granted rather than any file in the org.
router.get('/documents/:id/download', requirePortalPermission('documents.view'), async (req, res, next) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) throw new ApiError('Document not found', 404);
    const filter = { _id: req.params.id, organization: req.organizationId, [req.portal.type]: req.portal.recordId };
    const document = await Document.findOne(filter).lean();
    if (!document) throw new ApiError('Document not found', 404);

    const key = new URL(document.url).pathname.replace(/^\/files\//, '');
    await streamBlobByKey(key, res);
  } catch (e) { next(e); }
});

router.get('/invoices', requirePortalPermission('invoices.view'), async (req, res, next) => {
  try {
    const filter = { organization: req.organizationId, [req.portal.type]: req.portal.recordId };
    const invoices = await Invoice.find(filter).sort({ dueDate: -1 }).lean();
    return ok(res, { invoices });
  } catch (e) { next(e); }
});

router.get('/milestones', requirePortalPermission('milestones.view'), async (req, res, next) => {
  try {
    if (req.portal.type !== 'client') throw new ApiError('Not found', 404);
    const projects = await Project.find({ organization: req.organizationId, assignedClient: req.portal.recordId }).select('_id').lean();
    const milestones = await Milestone.find({ project: { $in: projects.map((p) => p._id) } }).sort({ dueDate: 1 }).lean();
    return ok(res, { milestones });
  } catch (e) { next(e); }
});

const approvalSchema = z.object({ status: z.enum(['approved', 'rejected']) });

router.patch('/milestones/:id/approval', requirePortalPermission('approvals.manage'), validate(approvalSchema), async (req, res, next) => {
  try {
    if (req.portal.type !== 'client') throw new ApiError('Not found', 404);
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) throw new ApiError('Milestone not found', 404);

    const milestone = await Milestone.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!milestone) throw new ApiError('Milestone not found', 404);
    const project = await Project.findOne({ _id: milestone.project, assignedClient: req.portal.recordId });
    if (!project) throw new ApiError('Milestone not found', 404);

    milestone.approvalStatus = req.body.status;
    milestone.approvedBy = req.user.id;
    milestone.approvedAt = new Date();
    await milestone.save();
    await logAudit(req, `milestone.${req.body.status}`, 'Milestone', milestone._id, { title: milestone.title });
    return ok(res, { milestone }, 'Milestone updated');
  } catch (e) { next(e); }
});

module.exports = router;
