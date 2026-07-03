const express = require('express');
const { z } = require('zod');
const Domain = require('../models/Domain');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { mountCrudExtensions, archivedFilter } = require('../utils/crudExtensions');

const router = express.Router();
router.use(requireAuth);

const READ_ROLES = ['superadmin', 'owner', 'finance', 'manager'];
const MANAGE_ROLES = ['superadmin', 'owner', 'finance'];

router.use(requireCompanyRole(READ_ROLES));

router.get('/', async (req, res, next) => {
  try {
    const { status, q } = req.query;
    const filter = { organization: req.organizationId, archived: archivedFilter(req) };
    if (status) filter.status = status;
    if (q) {
      const re = new RegExp(String(q).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [{ domainName: re }, { registrar: re }];
    }
    const domains = await Domain.find(filter).sort({ renewalDate: 1 }).populate('owner', 'name email avatarColor').lean();
    return ok(res, { domains });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const domain = await Domain.findOne({ _id: req.params.id, organization: req.organizationId }).populate('owner', 'name email avatarColor').lean();
    if (!domain) throw new ApiError('Domain not found', 404);
    return ok(res, { domain });
  } catch (e) { next(e); }
});

const bodySchema = z.object({
  domainName: z.string().trim().min(3).max(255),
  registrar: z.string().trim().min(1).max(120),
  dns: z.string().max(255).optional().default(''),
  sslExpiry: z.string().datetime().nullable().optional(),
  autoRenew: z.boolean().optional().default(true),
  cost: z.object({ amount: z.number().min(0), currency: z.string().optional().default('USD') }),
  renewalDate: z.string().datetime(),
  owner: z.string().nullable().optional(),
  status: z.enum(['active', 'expiring', 'expired']).optional().default('active'),
  notes: z.string().max(1000).optional().default(''),
});

router.post('/', requireCompanyRole(MANAGE_ROLES), validate(bodySchema), async (req, res, next) => {
  try {
    const domain = await Domain.create({ ...req.body, organization: req.organizationId });
    return ok(res, { domain }, 'Domain created', 201);
  } catch (e) { next(e); }
});

router.patch('/:id', requireCompanyRole(MANAGE_ROLES), validate(bodySchema.partial()), async (req, res, next) => {
  try {
    const domain = await Domain.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId },
      req.body,
      { new: true }
    );
    if (!domain) throw new ApiError('Domain not found', 404);
    return ok(res, { domain }, 'Domain updated');
  } catch (e) { next(e); }
});

router.delete('/:id', requireCompanyRole(MANAGE_ROLES), async (req, res, next) => {
  try {
    const domain = await Domain.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!domain) throw new ApiError('Domain not found', 404);
    return ok(res, null, 'Domain deleted');
  } catch (e) { next(e); }
});

mountCrudExtensions(router, {
  Model: Domain,
  requireCompanyRole,
  manageRoles: MANAGE_ROLES,
  patchSchema: bodySchema.partial(),
  resourceName: 'Domain',
  beforeDuplicate: async (obj) => {
    obj.domainName = `copy-of-${obj.domainName}`;
    return obj;
  },
});

module.exports = router;
