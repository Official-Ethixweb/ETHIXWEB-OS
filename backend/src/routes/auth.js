const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { z } = require('zod');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Invite = require('../models/Invite');
const Employee = require('../models/Employee');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { nextEmployeeId } = require('./employees');

const router = express.Router();

const signupSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    email: z.string().trim().toLowerCase().email().max(255),
    password: z.string().min(6).max(100),
    mode: z.enum(['create_org', 'join_invite']).default('create_org'),
    organizationName: z.string().trim().min(2).max(120).optional(),
    inviteToken: z.string().min(1).optional(),
  })
  .refine((data) => data.mode !== 'create_org' || !!data.organizationName, {
    message: 'organizationName is required to create a workspace',
    path: ['organizationName'],
  })
  .refine((data) => data.mode !== 'join_invite' || !!data.inviteToken, {
    message: 'inviteToken is required to join a workspace',
    path: ['inviteToken'],
  });

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(1).max(100),
});

function signToken(userId, organizationId) {
  return jwt.sign({ sub: String(userId), org: String(organizationId) }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function slugify(name) {
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'workspace';
}

async function generateUniqueSlug(name) {
  const base = slugify(name);
  let slug = base;
  let attempt = 0;
  while (await Organization.findOne({ slug })) {
    attempt += 1;
    slug = `${base}-${crypto.randomBytes(3).toString('hex')}`;
    if (attempt > 10) throw new ApiError('Could not generate a unique workspace URL, try a different name', 500);
  }
  return slug;
}

router.post('/signup', validate(signupSchema), async (req, res, next) => {
  try {
    const { name, email, password, mode } = req.body;
    const existing = await User.findOne({ email });
    if (existing) throw new ApiError('Email already registered', 409);

    const passwordHash = await User.hashPassword(password);

    if (mode === 'join_invite') {
      const invite = await Invite.findOne({ token: req.body.inviteToken, status: 'pending' });
      if (!invite) throw new ApiError('Invalid or expired invite', 400);
      if (invite.expiresAt < new Date()) {
        invite.status = 'expired';
        await invite.save();
        throw new ApiError('Invalid or expired invite', 400);
      }
      if (invite.email.toLowerCase() !== email.toLowerCase()) {
        throw new ApiError('This invite was issued for a different email address', 403);
      }

      const user = await User.create({
        name,
        email,
        passwordHash,
        organization: invite.organization,
        companyRole: invite.companyRole,
      });

      invite.status = 'accepted';
      invite.acceptedAt = new Date();
      invite.acceptedBy = user._id;
      await invite.save();

      const token = signToken(user._id, invite.organization);
      const populated = await User.findById(user._id).populate('organization', 'name slug');
      return ok(res, { token, user: populated.toJSON() }, 'Account created', 201);
    }

    // mode === 'create_org'
    // Organization.ownerUser and User.organization are both required, so
    // pre-generate the org's _id to break the circular dependency between them.
    const slug = await generateUniqueSlug(req.body.organizationName);
    const organizationId = new mongoose.Types.ObjectId();

    const user = await User.create({
      name,
      email,
      passwordHash,
      organization: organizationId,
      companyRole: 'owner',
    });

    const organization = await Organization.create({
      _id: organizationId,
      name: req.body.organizationName,
      slug,
      ownerUser: user._id,
    });

    const employeeId = await nextEmployeeId(organization._id);
    await Employee.create({
      organization: organization._id,
      user: user._id,
      employeeId,
      name,
      email,
      department: 'Operations',
      designation: 'Owner',
      companyRole: 'owner',
      joiningDate: new Date(),
      status: 'active',
    });

    const token = signToken(user._id, organization._id);
    const populated = await User.findById(user._id).populate('organization', 'name slug');
    return ok(res, { token, user: populated.toJSON() }, 'Account created', 201);
  } catch (e) { next(e); }
});

router.post('/login', validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new ApiError('Invalid email or password', 401);
    const okPw = await user.comparePassword(password);
    if (!okPw) throw new ApiError('Invalid email or password', 401);
    const token = signToken(user._id, user.organization);
    const populated = await User.findById(user._id).populate('organization', 'name slug');
    return ok(res, { token, user: populated.toJSON() }, 'Signed in');
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id).populate('organization', 'name slug');
    if (!user) throw new ApiError('User not found', 404);
    return ok(res, { user: user.toJSON() });
  } catch (e) { next(e); }
});

router.post('/logout', requireAuth, (_req, res) => ok(res, null, 'Signed out'));

module.exports = router;
