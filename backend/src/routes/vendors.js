const express = require('express');
const { z } = require('zod');
const Vendor = require('../models/Vendor');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { mountCrudExtensions, archivedFilter } = require('../utils/crudExtensions');

const router = express.Router();
router.use(requireAuth);

const READ_ROLES = ['superadmin', 'owner', 'finance', 'manager'];
const MANAGE_ROLES = ['superadmin', 'owner', 'finance', 'manager'];

router.use(requireCompanyRole(READ_ROLES));

router.get('/', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    const filter = { organization: req.organizationId, archived: archivedFilter(req) };
    if (status) filter.status = status;
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ name: re }, { category: re }, { email: re }];
    }
    const vendors = await Vendor.find(filter).sort({ createdAt: -1 }).lean();
    return ok(res, { vendors });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ _id: req.params.id, organization: req.organizationId }).lean();
    if (!vendor) throw new ApiError('Vendor not found', 404);
    return ok(res, { vendor });
  } catch (e) { next(e); }
});

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  category: z.string().max(120).optional().default(''),
  contactName: z.string().max(120).optional().default(''),
  email: z.string().trim().toLowerCase().email().max(255).optional().or(z.literal('')),
  phone: z.string().max(30).optional().default(''),
  address: z.string().max(500).optional().default(''),
  status: z.enum(['active', 'inactive']).optional().default('active'),
  contractValue: z.object({ amount: z.number().min(0), currency: z.string().optional().default('USD') }).optional(),
  notes: z.string().max(1000).optional().default(''),
});

router.post('/', requireCompanyRole(MANAGE_ROLES), validate(bodySchema), async (req, res, next) => {
  try {
    const vendor = await Vendor.create({ ...req.body, organization: req.organizationId });
    return ok(res, { vendor }, 'Vendor created', 201);
  } catch (e) { next(e); }
});

router.patch('/:id', requireCompanyRole(MANAGE_ROLES), validate(bodySchema.partial()), async (req, res, next) => {
  try {
    const vendor = await Vendor.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId },
      req.body,
      { new: true }
    );
    if (!vendor) throw new ApiError('Vendor not found', 404);
    return ok(res, { vendor }, 'Vendor updated');
  } catch (e) { next(e); }
});

router.delete('/:id', requireCompanyRole(MANAGE_ROLES), async (req, res, next) => {
  try {
    const vendor = await Vendor.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!vendor) throw new ApiError('Vendor not found', 404);
    return ok(res, null, 'Vendor deleted');
  } catch (e) { next(e); }
});

mountCrudExtensions(router, {
  Model: Vendor,
  requireCompanyRole,
  manageRoles: MANAGE_ROLES,
  patchSchema: bodySchema.partial(),
  resourceName: 'Vendor',
  beforeDuplicate: async (obj) => {
    obj.name = `Copy of ${obj.name}`;
    obj.email = '';
    return obj;
  },
});

module.exports = router;
