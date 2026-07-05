const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');
const Vendor = require('../models/Vendor');
const Client = require('../models/Client');
const { ApiError } = require('../utils/respond');
const { isIpAllowed } = require('../utils/ipAllowlist');
const { resolvePermissions } = require('../utils/rolePermissions');

function verifyAccessToken(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) throw new ApiError('Authentication required', 401);
  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw new ApiError('Invalid or expired token', 401);
  }
  if (payload.type && payload.type !== 'access') throw new ApiError('Invalid or expired token', 401);
  return payload;
}

// Every internal route (everything except routes/portal.js) uses this.
// Rejects external portal users (userType 'vendor'/'client') outright —
// they have no companyRole/permissions to speak of, so letting them past
// here would mean falling through to whatever a route does next, which is
// never correct for these accounts.
async function requireAuth(req, _res, next) {
  try {
    const payload = verifyAccessToken(req);

    const user = await User.findById(payload.sub)
      .populate('organization', 'ipAllowlist status')
      .populate('role', 'permissions')
      .lean();
    if (!user) throw new ApiError('User no longer exists', 401);
    if (user.userType && user.userType !== 'staff') throw new ApiError('This account cannot access this area', 403);
    if (user.organization?.status === 'suspended') throw new ApiError('This workspace has been suspended', 403);

    if (!isIpAllowed(req.ip, user.organization?.ipAllowlist)) {
      throw new ApiError('Access from this network is not permitted for your organization', 403);
    }

    req.organizationId = String(user.organization?._id || user.organization);
    const permissions = await resolvePermissions({
      organizationId: req.organizationId,
      companyRole: user.companyRole,
      role: user.role,
    });
    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      companyRole: user.companyRole,
      organization: req.organizationId,
      permissions,
    };
    next();
  } catch (e) {
    next(e);
  }
}

// Used only by routes/portal.js. Accepts vendor/client userTypes (rejects
// 'staff' — internal users use requireAuth + the app itself, not the
// external portal), resolves the caller's Vendor or Client record, and
// attaches its portalPermissions so portal routes can gate on them.
async function requirePortalAuth(req, _res, next) {
  try {
    const payload = verifyAccessToken(req);

    const user = await User.findById(payload.sub).populate('organization', 'name status').lean();
    if (!user) throw new ApiError('User no longer exists', 401);
    if (user.userType !== 'vendor' && user.userType !== 'client') {
      throw new ApiError('This account does not have portal access', 403);
    }
    if (user.organization?.status === 'suspended') throw new ApiError('This workspace has been suspended', 403);

    const Model = user.userType === 'vendor' ? Vendor : Client;
    const record = await Model.findOne({ portalUser: user._id, portalEnabled: true }).lean();
    if (!record) throw new ApiError('Portal access has been disabled for this account', 403);

    req.organizationId = String(user.organization?._id || user.organization);
    req.portal = {
      type: user.userType,
      recordId: String(record._id),
      permissions: record.portalPermissions || [],
    };
    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      organization: req.organizationId,
      organizationName: user.organization?.name || '',
    };
    next();
  } catch (e) {
    next(e);
  }
}

function requirePortalPermission(key) {
  return (req, _res, next) => {
    if (!req.portal?.permissions?.includes(key)) {
      return next(new ApiError('You do not have permission to view this', 403));
    }
    next();
  };
}

/**
 * Restricts access to a set of company-wide roles (superadmin/owner/hr/...).
 * Independent from requireProjectRole; this governs company modules (Employees,
 * and future Payroll/Finance), not per-project Kanban permissions.
 *
 * Prefer requirePermission() for anything new — this is kept for the couple
 * of routes (invites, org settings, roles admin) that are deliberately
 * owner/superadmin-only regardless of what a custom role might grant.
 */
function requireCompanyRole(roles = []) {
  return (req, _res, next) => {
    if (!roles.includes(req.user?.companyRole)) {
      return next(new ApiError('You do not have permission to perform this action', 403));
    }
    next();
  };
}

/**
 * Restricts access based on the requester's resolved permission set (see
 * utils/rolePermissions.js) instead of a hardcoded company-role array — the
 * actual grant is data (a Role document), editable per-organization through
 * the Roles admin UI, not a code change.
 */
function requirePermission(key) {
  return (req, _res, next) => {
    if (!req.user?.permissions?.includes(key)) {
      return next(new ApiError('You do not have permission to perform this action', 403));
    }
    next();
  };
}

/**
 * Loads project, ensures the requester is a member.
 * Attaches req.project and req.projectRole ('admin' | 'member').
 * Pass {role: 'admin'} to require admin.
 */
function requireProjectRole(opts = {}) {
  const needAdmin = opts.role === 'admin';
  return async (req, _res, next) => {
    try {
      const projectId = req.params.projectId || req.body.project || req.query.project;
      if (!projectId) throw new ApiError('projectId is required', 400);

      const project = await Project.findById(projectId);
      if (!project || String(project.organization) !== req.organizationId) {
        throw new ApiError('Project not found', 404);
      }

      const uid = req.user.id;
      const isOwner = String(project.owner) === uid;
      const member = project.members.find((m) => String(m.user) === uid);
      if (!isOwner && !member) throw new ApiError('You do not have access to this project', 403);

      const role = isOwner ? 'admin' : member.role;
      if (needAdmin && role !== 'admin') {
        throw new ApiError('Admin role required for this action', 403);
      }

      req.project = project;
      req.projectRole = role;
      next();
    } catch (e) {
      next(e);
    }
  };
}

module.exports = { requireAuth, requireProjectRole, requireCompanyRole, requirePermission, requirePortalAuth, requirePortalPermission };
