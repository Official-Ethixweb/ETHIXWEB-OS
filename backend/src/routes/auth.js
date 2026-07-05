const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const otplib = require('otplib');
const { z } = require('zod');
const User = require('../models/User');
const Organization = require('../models/Organization');
const Invite = require('../models/Invite');
const Employee = require('../models/Employee');
const RefreshToken = require('../models/RefreshToken');
const LoginEvent = require('../models/LoginEvent');
const Asset = require('../models/Asset');
const Attendance = require('../models/Attendance');
const Client = require('../models/Client');
const Department = require('../models/Department');
const Domain = require('../models/Domain');
const LeaveRequest = require('../models/LeaveRequest');
const Payslip = require('../models/Payslip');
const Project = require('../models/Project');
const Server = require('../models/Server');
const Subscription = require('../models/Subscription');
const Task = require('../models/Task');
const Team = require('../models/Team');
const Transaction = require('../models/Transaction');
const Vendor = require('../models/Vendor');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { nextEmployeeId } = require('./employees');
const { sendEmail } = require('../utils/email');
const { logAudit } = require('../utils/audit');
const { decryptField } = require('../utils/encryption');
const { resolvePermissions } = require('../utils/rolePermissions');
const { authLimiter, accountLimiter } = require('../middleware/rateLimit');
const logger = require('../utils/logger');

const ORG_SCOPED_MODELS = [
  Asset, Attendance, Client, Department, Domain, Employee, Invite,
  LeaveRequest, Payslip, Project, Server, Subscription, Task, Team, Transaction, Vendor,
];

const router = express.Router();

const MAX_LOGIN_ATTEMPTS = Number(process.env.MAX_LOGIN_ATTEMPTS || 5);
const LOCKOUT_MINUTES = Number(process.env.LOCKOUT_MINUTES || 15);
const ACCESS_TOKEN_TTL = '15m';
const MFA_TOKEN_TTL = '5m';
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const REFRESH_COOKIE_NAME = 'refreshToken';
const REFRESH_COOKIE_PATH = '/auth';

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

// --- token helpers ---

function signAccessToken(userId, organizationId) {
  return jwt.sign({ sub: String(userId), org: String(organizationId), type: 'access' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: ACCESS_TOKEN_TTL,
  });
}

function signMfaToken(userId) {
  return jwt.sign({ sub: String(userId), type: 'mfa' }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: MFA_TOKEN_TTL,
  });
}

function hashToken(raw) {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

async function issueRefreshToken(userId, req, family) {
  const raw = crypto.randomBytes(40).toString('hex');
  const fam = family || crypto.randomUUID();
  await RefreshToken.create({
    user: userId,
    tokenHash: hashToken(raw),
    family: fam,
    expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    createdByIp: req.ip,
    userAgent: req.headers['user-agent'] || null,
  });
  return { raw, family: fam };
}

function setRefreshCookie(res, raw) {
  res.cookie(REFRESH_COOKIE_NAME, raw, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_TTL_MS,
  });
}

function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { path: REFRESH_COOKIE_PATH });
}

// Issues a fresh access token + rotated refresh cookie for an already-verified user.
async function issueSession(user, req, res) {
  const accessToken = signAccessToken(user._id, user.organization);
  const { raw } = await issueRefreshToken(user._id, req);
  setRefreshCookie(res, raw);
  return accessToken;
}

// Every response that hands the frontend a User object also needs its
// resolved permission set (see utils/rolePermissions.js) so nav/route
// gating on the client can be permission-driven instead of re-hardcoding
// company-role arrays there too.
async function buildUserPayload(userId) {
  const user = await User.findById(userId)
    .populate('organization', 'name slug branding timezone currency enabledModules')
    .populate('role', 'name permissions');
  if (!user) return null;
  const permissions = await resolvePermissions({
    organizationId: String(user.organization?._id || user.organization),
    companyRole: user.companyRole,
    role: user.role,
  });
  return { ...user.toJSON(), permissions };
}

async function recordLoginEvent(user, req, success, reason) {
  try {
    await LoginEvent.create({
      user: user._id,
      organization: user.organization,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
      success,
      reason,
    });
  } catch (e) {
    logger.error('Failed to record login event', e);
  }
}

async function sendVerificationEmail(user) {
  const rawToken = crypto.randomBytes(32).toString('hex');
  user.emailVerificationTokenHash = hashToken(rawToken);
  user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await user.save();
  const verifyUrl = `${process.env.CLIENT_ORIGIN}/verify-email?token=${rawToken}`;
  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your ETHIXWEB OS email',
      html: `<p>Hi ${user.name},</p><p>Please confirm your email address:</p><p><a href="${verifyUrl}">${verifyUrl}</a></p>`,
    });
  } catch (e) {
    logger.error('Failed to send verification email', e);
  }
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

router.post('/signup', accountLimiter, validate(signupSchema), async (req, res, next) => {
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

      await sendVerificationEmail(user);
      const accessToken = await issueSession(user, req, res);
      return ok(res, { token: accessToken, user: await buildUserPayload(user._id) }, 'Account created', 201);
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

    await sendVerificationEmail(user);
    const accessToken = await issueSession(user, req, res);
    return ok(res, { token: accessToken, user: await buildUserPayload(user._id) }, 'Account created', 201);
  } catch (e) { next(e); }
});

router.post('/login', authLimiter, validate(loginSchema), async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) throw new ApiError('Invalid email or password', 401);

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      await recordLoginEvent(user, req, false, 'locked');
      throw new ApiError('Too many failed attempts. Please try again later.', 423);
    }

    const okPw = await user.comparePassword(password);
    if (!okPw) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_LOGIN_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCKOUT_MINUTES * 60 * 1000);
      }
      await user.save();
      await recordLoginEvent(user, req, false, 'bad_password');
      throw new ApiError('Invalid email or password', 401);
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    user.lastLoginIp = req.ip;
    await user.save();
    await recordLoginEvent(user, req, true, 'ok');

    if (user.twoFactorEnabled) {
      return ok(res, { mfaRequired: true, mfaToken: signMfaToken(user._id) }, 'Two-factor code required');
    }

    const accessToken = await issueSession(user, req, res);
    return ok(res, { token: accessToken, user: await buildUserPayload(user._id) }, 'Signed in');
  } catch (e) { next(e); }
});

async function findMatchingBackupCodeIndex(hashedCodes, plainCode) {
  for (let i = 0; i < hashedCodes.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    if (await bcrypt.compare(plainCode, hashedCodes[i])) return i;
  }
  return -1;
}

const mfaVerifySchema = z.object({ mfaToken: z.string().min(1), code: z.string().trim().min(6).max(10) });

router.post('/login/verify-2fa', authLimiter, validate(mfaVerifySchema), async (req, res, next) => {
  try {
    let payload;
    try {
      payload = jwt.verify(req.body.mfaToken, process.env.JWT_SECRET, { algorithms: ['HS256'] });
    } catch {
      throw new ApiError('This code has expired, please sign in again.', 401);
    }
    if (payload.type !== 'mfa') throw new ApiError('This code has expired, please sign in again.', 401);

    const user = await User.findById(payload.sub);
    if (!user || !user.twoFactorEnabled) throw new ApiError('This code has expired, please sign in again.', 401);

    const secret = decryptField(user.twoFactorSecret);
    const { valid } = await otplib.verify({ token: req.body.code, secret, algorithm: 'TOTP' });

    let ok2fa = valid;
    if (!ok2fa) {
      const idx = await findMatchingBackupCodeIndex(user.twoFactorBackupCodes, req.body.code);
      if (idx !== -1) {
        ok2fa = true;
        user.twoFactorBackupCodes.splice(idx, 1);
        await user.save();
      }
    }
    if (!ok2fa) throw new ApiError('Invalid code', 401);

    const accessToken = await issueSession(user, req, res);
    return ok(res, { token: accessToken, user: await buildUserPayload(user._id) }, 'Signed in');
  } catch (e) { next(e); }
});

router.get('/me', requireAuth, async (req, res, next) => {
  try {
    const user = await buildUserPayload(req.user.id);
    if (!user) throw new ApiError('User not found', 404);
    return ok(res, { user });
  } catch (e) { next(e); }
});

const deleteAccountSchema = z.object({
  password: z.string().min(1, 'Password is required'),
});

router.delete('/me', requireAuth, validate(deleteAccountSchema), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) throw new ApiError('User not found', 404);

    const okPw = await user.comparePassword(req.body.password);
    if (!okPw) throw new ApiError('Incorrect password', 401);

    if (user.companyRole === 'owner') {
      const otherMembers = await User.countDocuments({ organization: user.organization, _id: { $ne: user._id } });
      if (otherMembers > 0) {
        throw new ApiError(
          'You are the workspace owner. Remove or transfer the other members of your workspace before deleting your account.',
          400
        );
      }
      // Sole member of the org — deleting the owner deletes the whole workspace.
      await Promise.all(ORG_SCOPED_MODELS.map((Model) => Model.deleteMany({ organization: user.organization })));
      await Organization.deleteOne({ _id: user.organization });
    } else {
      await Employee.deleteOne({ user: user._id, organization: user.organization });
    }

    await logAudit(req, 'account.delete', 'User', user._id, { email: user.email, companyRole: user.companyRole });
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });
    await User.deleteOne({ _id: user._id });
    clearRefreshCookie(res);
    return ok(res, null, 'Account deleted');
  } catch (e) { next(e); }
});

const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
});

router.post('/forgot-password', accountLimiter, validate(forgotPasswordSchema), async (req, res, next) => {
  try {
    const user = await User.findOne({ email: req.body.email });
    if (user) {
      const rawToken = crypto.randomBytes(32).toString('hex');
      user.resetTokenHash = hashToken(rawToken);
      user.resetTokenExpires = new Date(Date.now() + 15 * 60 * 1000);
      await user.save();

      const resetUrl = `${process.env.CLIENT_ORIGIN}/reset-password?token=${rawToken}`;
      try {
        await sendEmail({
          to: user.email,
          subject: 'Reset your ETHIXWEB OS password',
          html: `<p>Hi ${user.name},</p><p>Click the link below to reset your password. This link expires in 15 minutes.</p><p><a href="${resetUrl}">${resetUrl}</a></p><p>If you didn't request this, you can ignore this email.</p>`,
        });
      } catch (emailErr) {
        // Don't leak email-send failures to the client — the token still exists,
        // and revealing this would confirm account existence to an attacker.
        logger.error('Failed to send password reset email', emailErr);
      }
    }
    // Always respond the same way regardless of whether the email was found,
    // so this endpoint can't be used to enumerate registered accounts.
    return ok(res, null, 'If an account exists for that email, a reset link has been sent.');
  } catch (e) { next(e); }
});

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(6).max(100),
});

router.post('/reset-password', accountLimiter, validate(resetPasswordSchema), async (req, res, next) => {
  try {
    const tokenHash = hashToken(req.body.token);
    const user = await User.findOne({ resetTokenHash: tokenHash, resetTokenExpires: { $gt: new Date() } });
    if (!user) throw new ApiError('This reset link is invalid or has expired.', 400);

    user.passwordHash = await User.hashPassword(req.body.password);
    user.resetTokenHash = null;
    user.resetTokenExpires = null;
    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    await user.save();

    // A password reset invalidates every existing session — someone else
    // holding a stolen refresh token shouldn't survive a password change.
    await RefreshToken.updateMany({ user: user._id, revokedAt: null }, { revokedAt: new Date() });

    return ok(res, null, 'Password reset. You can now sign in with your new password.');
  } catch (e) { next(e); }
});

const verifyEmailSchema = z.object({ token: z.string().min(1) });

router.post('/verify-email', accountLimiter, validate(verifyEmailSchema), async (req, res, next) => {
  try {
    const tokenHash = hashToken(req.body.token);
    const user = await User.findOne({ emailVerificationTokenHash: tokenHash, emailVerificationExpires: { $gt: new Date() } });
    if (!user) throw new ApiError('This verification link is invalid or has expired.', 400);
    user.emailVerified = true;
    user.emailVerificationTokenHash = null;
    user.emailVerificationExpires = null;
    await user.save();
    return ok(res, null, 'Email verified');
  } catch (e) { next(e); }
});

router.post('/verify-email/resend', requireAuth, accountLimiter, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.emailVerified) throw new ApiError('Email is already verified', 400);
    await sendVerificationEmail(user);
    return ok(res, null, 'Verification email sent');
  } catch (e) { next(e); }
});

// --- 2FA (TOTP) setup — opt-in, not enforced ---

router.post('/2fa/setup', requireAuth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (user.twoFactorEnabled) throw new ApiError('Two-factor authentication is already enabled', 400);
    const secret = await otplib.generateSecret();
    user.twoFactorSecret = secret; // encrypted at rest via the model's `set`
    await user.save();
    const otpauth = await otplib.generateURI({ issuer: 'ETHIXWEB OS', label: user.email, secret, algorithm: 'TOTP' });
    return ok(res, { otpauth, secret }, 'Scan this in your authenticator app, then verify a code to finish enabling.');
  } catch (e) { next(e); }
});

const twoFactorVerifySchema = z.object({ code: z.string().trim().min(6).max(10) });

router.post('/2fa/verify', requireAuth, validate(twoFactorVerifySchema), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user.twoFactorSecret) throw new ApiError('Run setup first', 400);
    const secret = decryptField(user.twoFactorSecret);
    const { valid } = await otplib.verify({ token: req.body.code, secret, algorithm: 'TOTP' });
    if (!valid) throw new ApiError('Invalid code', 400);

    const rawBackupCodes = Array.from({ length: 8 }, () => crypto.randomBytes(5).toString('hex'));
    user.twoFactorBackupCodes = await Promise.all(rawBackupCodes.map((c) => bcrypt.hash(c, 10)));
    user.twoFactorEnabled = true;
    await user.save();
    await logAudit(req, 'user.2fa_enabled', 'User', user._id);
    return ok(res, { backupCodes: rawBackupCodes }, 'Two-factor authentication enabled. Store these backup codes somewhere safe.');
  } catch (e) { next(e); }
});

const twoFactorDisableSchema = z.object({ password: z.string().min(1) });

router.post('/2fa/disable', requireAuth, validate(twoFactorDisableSchema), async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    const okPw = await user.comparePassword(req.body.password);
    if (!okPw) throw new ApiError('Incorrect password', 401);
    user.twoFactorEnabled = false;
    user.twoFactorSecret = null;
    user.twoFactorBackupCodes = [];
    await user.save();
    await logAudit(req, 'user.2fa_disabled', 'User', user._id);
    return ok(res, null, 'Two-factor authentication disabled');
  } catch (e) { next(e); }
});

// --- refresh / logout / sessions ---

router.post('/refresh', async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!raw) throw new ApiError('No active session', 401);
    const tokenHash = hashToken(raw);
    const existing = await RefreshToken.findOne({ tokenHash });

    if (!existing || existing.expiresAt < new Date()) {
      clearRefreshCookie(res);
      throw new ApiError('Session expired, please sign in again.', 401);
    }

    if (existing.revokedAt) {
      // Reuse of an already-rotated refresh token — the whole chain may be
      // compromised (e.g. a stolen cookie being replayed). Kill every token
      // in the family and force re-login rather than trusting it further.
      await RefreshToken.updateMany({ family: existing.family, revokedAt: null }, { revokedAt: new Date() });
      clearRefreshCookie(res);
      throw new ApiError('Session expired, please sign in again.', 401);
    }

    const user = await User.findById(existing.user);
    if (!user) {
      clearRefreshCookie(res);
      throw new ApiError('Session expired, please sign in again.', 401);
    }

    const { raw: newRaw } = await issueRefreshToken(user._id, req, existing.family);
    existing.revokedAt = new Date();
    existing.replacedByHash = hashToken(newRaw);
    await existing.save();
    setRefreshCookie(res, newRaw);

    const accessToken = signAccessToken(user._id, user.organization);
    return ok(res, { token: accessToken }, 'Refreshed');
  } catch (e) { next(e); }
});

router.post('/logout', async (req, res, next) => {
  try {
    const raw = req.cookies?.[REFRESH_COOKIE_NAME];
    if (raw) {
      await RefreshToken.updateOne({ tokenHash: hashToken(raw), revokedAt: null }, { revokedAt: new Date() });
    }
    clearRefreshCookie(res);
    return ok(res, null, 'Signed out');
  } catch (e) { next(e); }
});

router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await RefreshToken.updateMany({ user: req.user.id, revokedAt: null }, { revokedAt: new Date() });
    clearRefreshCookie(res);
    return ok(res, null, 'Signed out of all devices');
  } catch (e) { next(e); }
});

router.get('/sessions', requireAuth, async (req, res, next) => {
  try {
    const [devices, history] = await Promise.all([
      RefreshToken.find({ user: req.user.id, revokedAt: null, expiresAt: { $gt: new Date() } })
        .sort({ createdAt: -1 })
        .lean(),
      LoginEvent.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(20).lean(),
    ]);
    return ok(res, {
      devices: devices.map((d) => ({ id: d._id, ip: d.createdByIp, userAgent: d.userAgent, createdAt: d.createdAt })),
      history,
    });
  } catch (e) { next(e); }
});

router.post('/sessions/:id/revoke', requireAuth, async (req, res, next) => {
  try {
    if (!/^[0-9a-fA-F]{24}$/.test(req.params.id)) throw new ApiError('Session not found', 404);
    const result = await RefreshToken.updateOne(
      { _id: req.params.id, user: req.user.id, revokedAt: null },
      { revokedAt: new Date() }
    );
    if (result.matchedCount === 0) throw new ApiError('Session not found', 404);
    return ok(res, null, 'Session revoked');
  } catch (e) { next(e); }
});

module.exports = router;
