const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');
const { ApiError } = require('../utils/respond');
const { isIpAllowed } = require('../utils/ipAllowlist');

async function requireAuth(req, _res, next) {
  try {
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

    const user = await User.findById(payload.sub).populate('organization', 'ipAllowlist status').lean();
    if (!user) throw new ApiError('User no longer exists', 401);
    if (user.organization?.status === 'suspended') throw new ApiError('This workspace has been suspended', 403);

    if (!isIpAllowed(req.ip, user.organization?.ipAllowlist)) {
      throw new ApiError('Access from this network is not permitted for your organization', 403);
    }

    req.organizationId = String(user.organization?._id || user.organization);
    req.user = {
      id: String(user._id),
      email: user.email,
      name: user.name,
      companyRole: user.companyRole,
      organization: req.organizationId,
    };
    next();
  } catch (e) {
    next(e);
  }
}

/**
 * Restricts access to a set of company-wide roles (superadmin/owner/hr/...).
 * Independent from requireProjectRole; this governs company modules (Employees,
 * and future Payroll/Finance), not per-project Kanban permissions.
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

module.exports = { requireAuth, requireProjectRole, requireCompanyRole };
