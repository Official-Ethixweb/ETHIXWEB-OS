const express = require('express');
const { z } = require('zod');
const Organization = require('../models/Organization');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { logAudit } = require('../utils/audit');

const router = express.Router();
router.use(requireAuth);

const OWNER_ROLES = ['superadmin', 'owner'];

// Accepts an exact IPv4 address or an IPv4 CIDR block (e.g. "203.0.113.0/24").
const ipEntrySchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/, 'Must be an IPv4 address or CIDR block');

const ipAllowlistSchema = z.object({ ipAllowlist: z.array(ipEntrySchema).max(50) });

router.patch('/me/ip-allowlist', requireCompanyRole(OWNER_ROLES), validate(ipAllowlistSchema), async (req, res, next) => {
  try {
    const org = await Organization.findByIdAndUpdate(
      req.organizationId,
      { ipAllowlist: req.body.ipAllowlist },
      { new: true }
    );
    if (!org) throw new ApiError('Organization not found', 404);
    await logAudit(req, 'organization.ip_allowlist_update', 'Organization', org._id, { count: req.body.ipAllowlist.length });
    return ok(res, { ipAllowlist: org.ipAllowlist }, 'IP allowlist updated');
  } catch (e) { next(e); }
});

module.exports = router;
