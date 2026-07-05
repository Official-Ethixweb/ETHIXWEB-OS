const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const Vendor = require('../models/Vendor');
const Client = require('../models/Client');
const Document = require('../models/Document');
const Invoice = require('../models/Invoice');
const Milestone = require('../models/Milestone');
const { requireAuth } = require('../middleware/auth');
const { validate, idParamSchema } = require('../middleware/validate');
const { uploadDocument, uploadToBlob } = require('../middleware/upload');
const { ok, ApiError } = require('../utils/respond');
const { logAudit } = require('../utils/audit');
const { writeLimiter, uploadLimiter } = require('../middleware/rateLimit');
const { VENDOR_PORTAL_PERMISSIONS, CLIENT_PORTAL_PERMISSIONS, VENDOR_PORTAL_KEYS, CLIENT_PORTAL_KEYS } = require('../config/portalPermissions');

const router = express.Router();
router.use(requireAuth);

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

// Vendor and client management already implies managing that party's portal
// access and the documents/invoices/milestones shared with them — reuses the
// two existing registry keys rather than inventing a parallel "portal.manage"
// permission that admins would have to separately grant.
function requireManageFor(type) {
  const key = type === 'vendor' ? 'vendors.manage' : 'clients.manage';
  return (req, _res, next) => {
    if (!req.user?.permissions?.includes(key)) {
      return next(new ApiError('You do not have permission to perform this action', 403));
    }
    next();
  };
}

function requireVendorOrClientManage(req, _res, next) {
  const perms = req.user?.permissions || [];
  if (!perms.includes('vendors.manage') && !perms.includes('clients.manage')) {
    return next(new ApiError('You do not have permission to perform this action', 403));
  }
  next();
}

function typeGate(req, res, next) {
  return requireManageFor(req.params.type)(req, res, next);
}

router.get('/permissions', (req, res) => {
  return ok(res, { vendor: VENDOR_PORTAL_PERMISSIONS, client: CLIENT_PORTAL_PERMISSIONS });
});

// --- Portal invite + permission management for a vendor or client ---

// validate(schema, 'params') replaces req.params wholesale with the parsed
// object, so idParamSchema alone (just {id}) would silently drop the :type
// route param these handlers also read — this schema keeps both.
const typeIdParamSchema = z.object({ type: z.enum(['vendor', 'client']), id: z.string().regex(/^[0-9a-fA-F]{24}$/) });

async function findRecord(type, id, organizationId) {
  const Model = type === 'vendor' ? Vendor : Client;
  const record = await Model.findOne({ _id: id, organization: organizationId });
  if (!record) throw new ApiError(`${type === 'vendor' ? 'Vendor' : 'Client'} not found`, 404);
  return { Model, record };
}

router.post('/:type(vendor|client)/:id/invite', writeLimiter, typeGate, validate(typeIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { record } = await findRecord(type, id, req.organizationId);
    if (!record.email) throw new ApiError(`Add an email address to this ${type} before inviting them to the portal`, 400);
    if (record.portalUser) throw new ApiError('This contact already has a portal account', 409);

    const rawToken = crypto.randomBytes(24).toString('hex');
    record.portalInviteTokenHash = hashToken(rawToken);
    record.portalInviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await record.save();

    const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
    const inviteUrl = `${origin}/portal/accept-invite?type=${type}&token=${rawToken}`;
    await logAudit(req, `${type}.portal_invite`, type === 'vendor' ? 'Vendor' : 'Client', record._id, { email: record.email });
    return ok(res, { inviteUrl }, 'Portal invite created', 201);
  } catch (e) { next(e); }
});

const permissionsSchema = z.object({ portalPermissions: z.array(z.string()) });

router.patch('/:type(vendor|client)/:id/permissions', typeGate, validate(typeIdParamSchema, 'params'), validate(permissionsSchema), async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const validKeys = type === 'vendor' ? VENDOR_PORTAL_KEYS : CLIENT_PORTAL_KEYS;
    if (!req.body.portalPermissions.every((p) => validKeys.includes(p))) {
      throw new ApiError('Unknown permission key', 400);
    }
    const { record } = await findRecord(type, id, req.organizationId);
    record.portalPermissions = req.body.portalPermissions;
    await record.save();
    await logAudit(req, `${type}.portal_permissions_update`, type === 'vendor' ? 'Vendor' : 'Client', record._id, { permissions: req.body.portalPermissions });
    return ok(res, { portalPermissions: record.portalPermissions }, 'Portal permissions updated');
  } catch (e) { next(e); }
});

router.patch('/:type(vendor|client)/:id/toggle', typeGate, validate(typeIdParamSchema, 'params'), async (req, res, next) => {
  try {
    const { type, id } = req.params;
    const { record } = await findRecord(type, id, req.organizationId);
    record.portalEnabled = !record.portalEnabled;
    await record.save();
    await logAudit(req, `${type}.portal_toggle`, type === 'vendor' ? 'Vendor' : 'Client', record._id, { portalEnabled: record.portalEnabled });
    return ok(res, { portalEnabled: record.portalEnabled });
  } catch (e) { next(e); }
});

// --- Documents (shared with a project/vendor/client's portal) ---

const documentQuerySchema = z.object({
  project: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  vendor: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  client: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
});

router.get('/documents', requireVendorOrClientManage, validate(documentQuerySchema, 'query'), async (req, res, next) => {
  try {
    const filter = { organization: req.organizationId };
    if (req.query.project) filter.project = req.query.project;
    if (req.query.vendor) filter.vendor = req.query.vendor;
    if (req.query.client) filter.client = req.query.client;
    const documents = await Document.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, { documents });
  } catch (e) { next(e); }
});

router.post('/documents', uploadLimiter, requireVendorOrClientManage, uploadDocument.single('file'), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError('file is required', 400);
    const { project, vendor, client, name } = req.body;
    if (!project && !vendor && !client) throw new ApiError('One of project, vendor, or client is required', 400);
    const url = await uploadToBlob(req, req.file, 'portal-documents');
    const doc = await Document.create({
      organization: req.organizationId,
      project: project || null,
      vendor: vendor || null,
      client: client || null,
      name: name || req.file.originalname,
      url,
      uploadedBy: req.user.id,
    });
    return ok(res, { document: doc }, 'Document uploaded', 201);
  } catch (e) { next(e); }
});

router.delete('/documents/:id', requireVendorOrClientManage, validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const doc = await Document.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!doc) throw new ApiError('Document not found', 404);
    return ok(res, null, 'Document deleted');
  } catch (e) { next(e); }
});

// --- Invoices ---

const invoiceSchema = z.object({
  vendor: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
  client: z.string().regex(/^[0-9a-fA-F]{24}$/).nullable().optional(),
  number: z.string().trim().min(1).max(60),
  amount: z.number().min(0),
  currency: z.string().optional().default('USD'),
  status: z.enum(['draft', 'sent', 'paid', 'overdue']).optional().default('draft'),
  dueDate: z.string().datetime(),
  notes: z.string().max(1000).optional().default(''),
});

router.get('/invoices', requireVendorOrClientManage, async (req, res, next) => {
  try {
    const filter = { organization: req.organizationId };
    if (req.query.vendor) filter.vendor = req.query.vendor;
    if (req.query.client) filter.client = req.query.client;
    const invoices = await Invoice.find(filter).sort({ dueDate: -1 }).lean();
    return ok(res, { invoices });
  } catch (e) { next(e); }
});

router.post('/invoices', writeLimiter, requireVendorOrClientManage, validate(invoiceSchema), async (req, res, next) => {
  try {
    if (!req.body.vendor && !req.body.client) throw new ApiError('One of vendor or client is required', 400);
    const invoice = await Invoice.create({ ...req.body, organization: req.organizationId });
    return ok(res, { invoice }, 'Invoice created', 201);
  } catch (e) { next(e); }
});

router.patch('/invoices/:id', requireVendorOrClientManage, validate(idParamSchema, 'params'), validate(invoiceSchema.partial()), async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndUpdate({ _id: req.params.id, organization: req.organizationId }, req.body, { new: true });
    if (!invoice) throw new ApiError('Invoice not found', 404);
    return ok(res, { invoice }, 'Invoice updated');
  } catch (e) { next(e); }
});

router.delete('/invoices/:id', requireVendorOrClientManage, validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const invoice = await Invoice.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!invoice) throw new ApiError('Invoice not found', 404);
    return ok(res, null, 'Invoice deleted');
  } catch (e) { next(e); }
});

// --- Milestones ---

const milestoneSchema = z.object({
  project: z.string().regex(/^[0-9a-fA-F]{24}$/),
  title: z.string().trim().min(1).max(200),
  description: z.string().max(1000).optional().default(''),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(['pending', 'in_progress', 'completed']).optional().default('pending'),
});

router.get('/milestones', requireVendorOrClientManage, async (req, res, next) => {
  try {
    const filter = { organization: req.organizationId };
    if (req.query.project) filter.project = req.query.project;
    const milestones = await Milestone.find(filter).sort({ dueDate: 1 }).lean();
    return ok(res, { milestones });
  } catch (e) { next(e); }
});

router.post('/milestones', writeLimiter, requireVendorOrClientManage, validate(milestoneSchema), async (req, res, next) => {
  try {
    const milestone = await Milestone.create({ ...req.body, organization: req.organizationId, approvalStatus: 'pending' });
    return ok(res, { milestone }, 'Milestone created', 201);
  } catch (e) { next(e); }
});

router.patch('/milestones/:id', requireVendorOrClientManage, validate(idParamSchema, 'params'), validate(milestoneSchema.partial()), async (req, res, next) => {
  try {
    const milestone = await Milestone.findOneAndUpdate({ _id: req.params.id, organization: req.organizationId }, req.body, { new: true });
    if (!milestone) throw new ApiError('Milestone not found', 404);
    return ok(res, { milestone }, 'Milestone updated');
  } catch (e) { next(e); }
});

router.delete('/milestones/:id', requireVendorOrClientManage, validate(idParamSchema, 'params'), async (req, res, next) => {
  try {
    const milestone = await Milestone.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!milestone) throw new ApiError('Milestone not found', 404);
    return ok(res, null, 'Milestone deleted');
  } catch (e) { next(e); }
});

module.exports = router;
