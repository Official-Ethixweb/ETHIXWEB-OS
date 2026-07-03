const express = require('express');
const crypto = require('crypto');
const { z } = require('zod');
const Invite = require('../models/Invite');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');

const router = express.Router();

const OWNER_ROLES = ['superadmin', 'owner'];

// Public: lets the signup screen preview which org/email an invite is for, before submitting.
router.get('/:token/preview', async (req, res, next) => {
  try {
    const invite = await Invite.findOne({ token: req.params.token, status: 'pending' }).populate('organization', 'name');
    if (!invite || invite.expiresAt < new Date()) throw new ApiError('Invalid or expired invite', 404);
    return ok(res, { organizationName: invite.organization.name, email: invite.email, companyRole: invite.companyRole });
  } catch (e) { next(e); }
});

router.use(requireAuth);

const createSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  companyRole: z
    .enum(['superadmin', 'owner', 'hr', 'finance', 'manager', 'developer', 'designer', 'qa', 'employee', 'viewer'])
    .optional()
    .default('employee'),
});

function buildInviteUrl(req, token) {
  const origin = req.headers.origin || `${req.protocol}://${req.get('host')}`;
  return `${origin}/signup?invite=${token}`;
}

router.get('/', requireCompanyRole(OWNER_ROLES), async (req, res, next) => {
  try {
    const invites = await Invite.find({ organization: req.organizationId, status: 'pending' })
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, { invites: invites.map((i) => ({ ...i, inviteUrl: buildInviteUrl(req, i.token) })) });
  } catch (e) { next(e); }
});

router.post('/', requireCompanyRole(OWNER_ROLES), validate(createSchema), async (req, res, next) => {
  try {
    const { email, companyRole } = req.body;
    const existingPending = await Invite.findOne({ organization: req.organizationId, email, status: 'pending' });
    if (existingPending) throw new ApiError('An invite for this email is already pending', 409);

    const token = crypto.randomBytes(24).toString('hex');
    const invite = await Invite.create({
      organization: req.organizationId,
      email,
      companyRole,
      token,
      invitedBy: req.user.id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    });

    return ok(res, { invite: invite.toObject(), inviteUrl: buildInviteUrl(req, token) }, 'Invite created', 201);
  } catch (e) { next(e); }
});

router.delete('/:id', requireCompanyRole(OWNER_ROLES), async (req, res, next) => {
  try {
    const invite = await Invite.findOneAndUpdate(
      { _id: req.params.id, organization: req.organizationId, status: 'pending' },
      { status: 'revoked' },
      { new: true }
    );
    if (!invite) throw new ApiError('Invite not found', 404);
    return ok(res, null, 'Invite revoked');
  } catch (e) { next(e); }
});

module.exports = router;
