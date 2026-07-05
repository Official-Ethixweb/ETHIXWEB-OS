const express = require('express');
const { z } = require('zod');
const DashboardLayout = require('../models/DashboardLayout');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

// Per-user, not per-role or per-org — everyone arranges their own dashboard.
router.get('/', async (req, res, next) => {
  try {
    const doc = await DashboardLayout.findOne({ user: req.user.id, organization: req.organizationId }).lean();
    return ok(res, { layout: doc?.layout ?? [], hiddenWidgets: doc?.hiddenWidgets ?? [] });
  } catch (e) { next(e); }
});

const layoutItemSchema = z.object({
  i: z.string().min(1).max(120),
  x: z.number().int().min(0),
  y: z.number().int().min(0),
  w: z.number().int().min(1),
  h: z.number().int().min(1),
});

const saveSchema = z.object({
  layout: z.array(layoutItemSchema).max(100),
  hiddenWidgets: z.array(z.string().max(120)).max(100),
});

router.put('/', validate(saveSchema), async (req, res, next) => {
  try {
    const doc = await DashboardLayout.findOneAndUpdate(
      { user: req.user.id, organization: req.organizationId },
      { layout: req.body.layout, hiddenWidgets: req.body.hiddenWidgets },
      { upsert: true, new: true }
    );
    return ok(res, { layout: doc.layout, hiddenWidgets: doc.hiddenWidgets }, 'Layout saved');
  } catch (e) { next(e); }
});

router.delete('/', async (req, res, next) => {
  try {
    await DashboardLayout.deleteOne({ user: req.user.id, organization: req.organizationId });
    return ok(res, null, 'Layout reset');
  } catch (e) { next(e); }
});

module.exports = router;
