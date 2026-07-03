const express = require('express');
const { z } = require('zod');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

const SAFE_FIELDS = '-passwordHash -resetTokenHash -resetTokenExpires -failedLoginAttempts -lockedUntil -twoFactorSecret -twoFactorBackupCodes -emailVerificationTokenHash -emailVerificationExpires';

const searchQuerySchema = z.object({ q: z.string().trim().max(200).optional().default('') });

// Search users by name or email (used by Invite dialogs).
router.get('/search', validate(searchQuerySchema, 'query'), async (req, res, next) => {
  try {
    const q = req.query.q;
    if (!q) return ok(res, { users: [] });
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ organization: req.organizationId, $or: [{ name: re }, { email: re }] })
      .select(SAFE_FIELDS)
      .limit(10)
      .lean();
    return ok(res, { users });
  } catch (e) { next(e); }
});

// List "me" only; listing all users is intentionally NOT supported for privacy.
router.get('/', async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id).select(SAFE_FIELDS).lean();
    return ok(res, { users: me ? [me] : [] });
  } catch (e) { next(e); }
});

module.exports = router;
