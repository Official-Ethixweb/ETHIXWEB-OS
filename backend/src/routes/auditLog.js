const express = require('express');
const { z } = require('zod');
const AuditLog = require('../models/AuditLog');
const { requireAuth, requirePermission } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);
router.use(requirePermission('audit_log.view'));

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  action: z.string().max(100).optional(),
});

router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const { page, limit, action } = req.query;
    const filter = { organization: req.organizationId };
    if (action) filter.action = action;

    const [entries, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actor', 'name email')
        .lean(),
      AuditLog.countDocuments(filter),
    ]);

    return ok(res, { entries, total, page, limit });
  } catch (e) { next(e); }
});

module.exports = router;
