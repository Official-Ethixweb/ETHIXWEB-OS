const express = require('express');
const { z } = require('zod');
const Organization = require('../models/Organization');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { uploadPhoto, uploadToBlob } = require('../middleware/upload');
const { ok, ApiError } = require('../utils/respond');
const { logAudit } = require('../utils/audit');
const { uploadLimiter } = require('../middleware/rateLimit');

const router = express.Router();
router.use(requireAuth);

// Every authenticated member can read the org's own settings — the nav
// needs enabledModules to decide what to show, and branding needs to be
// visible to everyone, not just the owner who can edit it.
router.get('/me', async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId);
    if (!org) throw new ApiError('Organization not found', 404);
    return ok(res, { organization: org.toJSON ? org.toJSON() : org });
  } catch (e) { next(e); }
});

const settingsSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  timezone: z.string().trim().min(1).max(60).optional(),
  currency: z.string().trim().length(3).optional(),
  primaryColor: z.string().trim().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #8A181C').optional(),
  enabledModules: z.array(z.enum(Organization.TOGGLEABLE_MODULES)).optional(),
});

router.patch('/me', requirePermission('organization.manage_settings'), validate(settingsSchema), async (req, res, next) => {
  try {
    const org = await Organization.findById(req.organizationId);
    if (!org) throw new ApiError('Organization not found', 404);

    const { name, timezone, currency, primaryColor, enabledModules } = req.body;
    if (name !== undefined) org.name = name;
    if (timezone !== undefined) org.timezone = timezone;
    if (currency !== undefined) org.currency = currency;
    if (primaryColor !== undefined) org.branding.primaryColor = primaryColor;
    if (enabledModules !== undefined) org.enabledModules = enabledModules;
    await org.save();

    await logAudit(req, 'organization.settings_update', 'Organization', org._id, req.body);
    return ok(res, { organization: org.toJSON() }, 'Settings updated');
  } catch (e) { next(e); }
});

router.post('/me/logo', uploadLimiter, requirePermission('organization.manage_settings'), uploadPhoto.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) throw new ApiError('logo file is required', 400);
    const org = await Organization.findById(req.organizationId);
    if (!org) throw new ApiError('Organization not found', 404);
    org.branding.logoUrl = await uploadToBlob(req, req.file, 'branding', 'image');
    await org.save();
    await logAudit(req, 'organization.logo_update', 'Organization', org._id);
    return ok(res, { organization: org.toJSON() }, 'Logo updated');
  } catch (e) { next(e); }
});

// Accepts an exact IPv4 address or an IPv4 CIDR block (e.g. "203.0.113.0/24").
const ipEntrySchema = z
  .string()
  .trim()
  .regex(/^\d{1,3}(\.\d{1,3}){3}(\/\d{1,2})?$/, 'Must be an IPv4 address or CIDR block');

const ipAllowlistSchema = z.object({ ipAllowlist: z.array(ipEntrySchema).max(50) });

router.patch('/me/ip-allowlist', requirePermission('organization.manage_settings'), validate(ipAllowlistSchema), async (req, res, next) => {
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
