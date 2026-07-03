const express = require('express');
const { z } = require('zod');
const Task = require('../models/Task');
const Project = require('../models/Project');
const { requireAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');

const router = express.Router();
router.use(requireAuth);

/**
 * Inline RBAC helper for tasks. We can't reuse requireProjectRole because the
 * projectId comes from the task body or task record itself.
 */
async function loadProjectAndRole(req, projectId) {
  const project = await Project.findById(projectId);
  if (!project || String(project.organization) !== req.organizationId) {
    throw new ApiError('Project not found', 404);
  }
  const uid = req.user.id;
  const isOwner = String(project.owner) === uid;
  const member = project.members.find((m) => String(m.user) === uid);
  if (!isOwner && !member) throw new ApiError('You do not have access to this project', 403);
  return { project, role: isOwner ? 'admin' : member.role };
}

async function populateTask(id) {
  return Task.findById(id).populate('assignee', 'name email avatarColor').lean();
}

const listQuerySchema = z.object({ project: z.string().regex(/^[0-9a-fA-F]{24}$/, 'project must be a valid id') });

// --- List tasks for a project ---
router.get('/', validate(listQuerySchema, 'query'), async (req, res, next) => {
  try {
    const projectId = req.query.project;
    await loadProjectAndRole(req, projectId);
    const tasks = await Task.find({ project: projectId, organization: req.organizationId })
      .populate('assignee', 'name email avatarColor')
      .sort({ status: 1, order: 1, createdAt: 1 })
      .lean();
    return ok(res, { tasks }, 'Tasks fetched');
  } catch (e) { next(e); }
});

const createSchema = z.object({
  project: z.string().min(1, 'project is required'),
  title: z.string().trim().min(1).max(140),
  description: z.string().max(2000).optional().default(''),
  assignee: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional().default('todo'),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  dueDate: z.string().datetime().nullable().optional(),
});

// --- Create task (any member) ---
router.post('/', validate(createSchema), async (req, res, next) => {
  try {
    const body = req.body;
    const { project, role } = await loadProjectAndRole(req, body.project);

    // Members cannot pre-assign tasks; only admins can.
    if (role !== 'admin' && body.assignee) {
      throw new ApiError('Only admins can assign tasks', 403);
    }
    if (body.assignee) {
      const isMember =
        String(project.owner) === String(body.assignee) ||
        project.members.some((m) => String(m.user) === String(body.assignee));
      if (!isMember) throw new ApiError('Assignee must be a project member', 400);
    }

    const count = await Task.countDocuments({ project: project._id, status: body.status });

    const task = await Task.create({
      organization: req.organizationId,
      project: project._id,
      title: body.title,
      description: body.description || '',
      assignee: body.assignee || null,
      status: body.status,
      priority: body.priority,
      dueDate: body.dueDate || null,
      order: count,
      createdBy: req.user.id,
    });
    const populated = await populateTask(task._id);
    return ok(res, { task: populated }, 'Task created', 201);
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  title: z.string().trim().min(1).max(140).optional(),
  description: z.string().max(2000).optional(),
  assignee: z.string().nullable().optional(),
  status: z.enum(['todo', 'in_progress', 'done']).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  order: z.number().int().min(0).optional(),
});

// --- Update task ---
// Members: status + order only.
// Admins: anything.
router.patch('/:id', validate(updateSchema), async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!task) throw new ApiError('Task not found', 404);
    const { project, role } = await loadProjectAndRole(req, task.project);

    const patch = req.body;
    if (role !== 'admin') {
      const allowed = ['status', 'order'];
      const disallowed = Object.keys(patch).filter((k) => !allowed.includes(k));
      if (disallowed.length) {
        throw new ApiError(
          `Members can only update status. Forbidden fields: ${disallowed.join(', ')}`,
          403
        );
      }
    }

    if ('assignee' in patch && patch.assignee) {
      const isMember =
        String(project.owner) === String(patch.assignee) ||
        project.members.some((m) => String(m.user) === String(patch.assignee));
      if (!isMember) throw new ApiError('Assignee must be a project member', 400);
    }

    Object.assign(task, patch);
    await task.save();
    const populated = await populateTask(task._id);
    return ok(res, { task: populated }, 'Task updated');
  } catch (e) { next(e); }
});

// --- Delete task (admin only) ---
router.delete('/:id', async (req, res, next) => {
  try {
    const task = await Task.findOne({ _id: req.params.id, organization: req.organizationId });
    if (!task) throw new ApiError('Task not found', 404);
    const { role } = await loadProjectAndRole(req, task.project);
    if (role !== 'admin') throw new ApiError('Only admins can delete tasks', 403);
    await Task.deleteOne({ _id: task._id });
    return ok(res, null, 'Task deleted');
  } catch (e) { next(e); }
});

module.exports = router;
