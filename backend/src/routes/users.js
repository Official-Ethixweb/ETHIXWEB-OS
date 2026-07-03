const express = require('express');
const User = require('../models/User');
const { requireAuth } = require('../middleware/auth');
const { ok } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

// Search users by name or email (used by Invite dialogs).
router.get('/search', async (req, res, next) => {
  try {
    const q = String(req.query.q || '').trim();
    if (!q) return ok(res, { users: [] });
    const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    const users = await User.find({ organization: req.organizationId, $or: [{ name: re }, { email: re }] })
      .limit(10)
      .lean();
    return ok(res, { users: users.map((u) => ({ ...u, passwordHash: undefined })) });
  } catch (e) { next(e); }
});

// List "me" only; listing all users is intentionally NOT supported for privacy.
router.get('/', async (req, res, next) => {
  try {
    const me = await User.findById(req.user.id).lean();
    return ok(res, { users: me ? [{ ...me, passwordHash: undefined }] : [] });
  } catch (e) { next(e); }
});

module.exports = router;
