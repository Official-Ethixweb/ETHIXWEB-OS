const express = require('express');
const { z } = require('zod');
const Project = require('../models/Project');
const Task = require('../models/Task');
const User = require('../models/User');
const Vendor = require('../models/Vendor');
const Client = require('../models/Client');
const { requireAuth, requireProjectRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

async function populateProject(projectId) {
  return Project.findById(projectId)
    .populate('owner', 'name email avatarColor')
    .populate('members.user', 'name email avatarColor')
    .lean();
}

// --- List my projects ---
router.get('/', async (req, res, next) => {
  try {
    const uid = req.user.id;
    const projects = await Project.find({
      organization: req.organizationId,
      $or: [{ owner: uid }, { 'members.user': uid }],
    })
      .populate('owner', 'name email avatarColor')
      .populate('members.user', 'name email avatarColor')
      .sort({ createdAt: -1 })
      .lean();
    return ok(res, { projects }, 'Projects fetched');
  } catch (e) { next(e); }
});

// --- Get one project ---
router.get('/:projectId', requireProjectRole(), async (req, res, next) => {
  try {
    const project = await populateProject(req.project._id);
    return ok(res, { project, role: req.projectRole });
  } catch (e) { next(e); }
});

// --- Create ---
const createSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional().default(''),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'Invalid color').optional(),
});

router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const { name, description, color } = req.body;
    const project = await Project.create({
      organization: req.organizationId,
      name,
      description,
      color: color || '#6366F1',
      owner: req.user.id,
      members: [{ user: req.user.id, role: 'admin' }],
    });
    const populated = await populateProject(project._id);
    return ok(res, { project: populated }, 'Project created', 201);
  } catch (e) { next(e); }
});

// --- Update (admin only) ---
const objectIdOrNull = z.string().regex(/^[0-9a-fA-F]{24}$/).nullable();
const updateSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  description: z.string().max(500).optional(),
  color: z.string().regex(/^#?[0-9a-fA-F]{6}$/, 'Invalid color').optional(),
  assignedVendor: objectIdOrNull.optional(),
  assignedClient: objectIdOrNull.optional(),
});

router.patch(
  '/:projectId',
  requireProjectRole({ role: 'admin' }),
  validate(updateSchema),
  async (req, res, next) => {
    try {
      if (req.body.assignedVendor) {
        const vendor = await Vendor.findOne({ _id: req.body.assignedVendor, organization: req.organizationId });
        if (!vendor) throw new ApiError('Vendor not found', 404);
      }
      if (req.body.assignedClient) {
        const client = await Client.findOne({ _id: req.body.assignedClient, organization: req.organizationId });
        if (!client) throw new ApiError('Client not found', 404);
      }
      Object.assign(req.project, req.body);
      await req.project.save();
      const populated = await populateProject(req.project._id);
      return ok(res, { project: populated }, 'Project updated');
    } catch (e) { next(e); }
  }
);

// --- Delete (admin only) ---
router.delete(
  '/:projectId',
  requireProjectRole({ role: 'admin' }),
  async (req, res, next) => {
    try {
      await Task.deleteMany({ project: req.project._id });
      await Project.deleteOne({ _id: req.project._id });
      return ok(res, null, 'Project deleted');
    } catch (e) { next(e); }
  }
);

// --- Add member (admin only) ---
const addMemberSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  role: z.enum(['admin', 'member']).default('member'),
});

router.post(
  '/:projectId/members',
  requireProjectRole({ role: 'admin' }),
  validate(addMemberSchema),
  async (req, res, next) => {
    try {
      const { email, role } = req.body;
      const user = await User.findOne({ email, organization: req.organizationId });
      if (!user) throw new ApiError('No user found with that email', 404);

      const project = req.project;
      if (project.members.some((m) => String(m.user) === String(user._id))) {
        throw new ApiError('User is already a member', 409);
      }
      project.members.push({ user: user._id, role });
      await project.save();
      const populated = await populateProject(project._id);
      return ok(res, { project: populated }, 'Member added');
    } catch (e) { next(e); }
  }
);

// --- Update member role (admin only) ---
const updateRoleSchema = z.object({
  role: z.enum(['admin', 'member']),
});

router.patch(
  '/:projectId/members/:userId',
  requireProjectRole({ role: 'admin' }),
  validate(updateRoleSchema),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { role } = req.body;
      const project = req.project;

      if (String(project.owner) === String(userId)) {
        throw new ApiError("Cannot change the project owner's role", 400);
      }
      const member = project.members.find((m) => String(m.user) === String(userId));
      if (!member) throw new ApiError('Member not found', 404);

      member.role = role;
      await project.save();
      const populated = await populateProject(project._id);
      return ok(res, { project: populated }, 'Member role updated');
    } catch (e) { next(e); }
  }
);

// --- Remove member (admin only) ---
router.delete(
  '/:projectId/members/:userId',
  requireProjectRole({ role: 'admin' }),
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const project = req.project;
      if (String(project.owner) === String(userId)) {
        throw new ApiError('Cannot remove the project owner', 400);
      }
      const before = project.members.length;
      project.members = project.members.filter((m) => String(m.user) !== String(userId));
      if (project.members.length === before) throw new ApiError('Member not found', 404);
      await project.save();
      const populated = await populateProject(project._id);
      return ok(res, { project: populated }, 'Member removed');
    } catch (e) { next(e); }
  }
);

module.exports = router;
