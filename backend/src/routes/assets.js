const express = require('express');
const { z } = require('zod');
const Asset = require('../models/Asset');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { mountCrudExtensions, archivedFilter } = require('../utils/crudExtensions');

const router = express.Router();
router.use(requireAuth);

const READ_ROLES = ['superadmin', 'owner', 'finance', 'manager', 'hr'];
const MANAGE_ROLES = ['superadmin', 'owner', 'finance', 'manager', 'hr'];

router.use(requireCompanyRole(READ_ROLES));

router.get('/', async (req, res, next) => {
  try {
    const { status, category, assignedTo, q } = req.query;
    const filter = { organization: req.organizationId, archived: archivedFilter(req) };
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (assignedTo) filter.assignedTo = assignedTo;
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ label: re }, { serialNumber: re }, { vendor: re }];
    }
    const assets = await Asset.find(filter).sort({ createdAt: -1 }).populate('assignedTo', 'name employeeId photoUrl').lean();
    return ok(res, { assets });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const asset = await Asset.findOne({ _id: req.params.id, organization: req.organizationId }).populate('assignedTo', 'name employeeId photoUrl').lean();
    if (!asset) throw new ApiError('Asset not found', 404);
    return ok(res, { asset });
  } catch (e) { next(e); }
});

const bodySchema = z.object({
  label: z.string().trim().min(1).max(120),
  category: z.enum(['Laptop', 'Desktop', 'Monitor', 'Phone', 'Software License', 'Furniture', 'Networking', 'Other']).optional().default('Other'),
  serialNumber: z.string().max(120).optional().default(''),
  vendor: z.string().max(120).optional().default(''),
  purchaseDate: z.string().datetime().nullable().optional(),
  warrantyExpiry: z.string().datetime().nullable().optional(),
  cost: z.object({ amount: z.number().min(0), currency: z.string().optional().default('USD') }).optional(),
  assignedTo: z.string().nullable().optional(),
  status: z.enum(['available', 'in_use', 'maintenance', 'retired']).optional().default('available'),
  notes: z.string().max(1000).optional().default(''),
});

router.post('/', requireCompanyRole(MANAGE_ROLES), validate(bodySchema), async (req, res, next) => {
  try {
    const asset = await Asset.create({ ...req.body, organization: req.organizationId });
    const populated = await Asset.findById(asset._id).populate('assignedTo', 'name employeeId photoUrl').lean();
    return ok(res, { asset: populated }, 'Asset created', 201);
  } catch (e) { next(e); }
});

router.patch('/:id', requireCompanyRole(MANAGE_ROLES), validate(bodySchema.partial()), async (req, res, next) => {
  try {
    const asset = await Asset.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId },
      req.body,
      { new: true }
    ).populate('assignedTo', 'name employeeId photoUrl');
    if (!asset) throw new ApiError('Asset not found', 404);
    return ok(res, { asset }, 'Asset updated');
  } catch (e) { next(e); }
});

router.delete('/:id', requireCompanyRole(MANAGE_ROLES), async (req, res, next) => {
  try {
    const asset = await Asset.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!asset) throw new ApiError('Asset not found', 404);
    return ok(res, null, 'Asset deleted');
  } catch (e) { next(e); }
});

mountCrudExtensions(router, {
  Model: Asset,
  requireCompanyRole,
  manageRoles: MANAGE_ROLES,
  patchSchema: bodySchema.partial(),
  resourceName: 'Asset',
  beforeDuplicate: async (obj) => {
    obj.label = `Copy of ${obj.label}`;
    obj.serialNumber = '';
    obj.assignedTo = null;
    obj.status = 'available';
    return obj;
  },
});

module.exports = router;
