const express = require('express');
const { z } = require('zod');
const Team = require('../models/Team');
const { requireAuth, requireCompanyRole } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('../utils/respond');
const { mountCrudExtensions, archivedFilter } = require('../utils/crudExtensions');

const router = express.Router();
router.use(requireAuth);

const HR_ROLES = ['superadmin', 'owner', 'hr'];

function populateTeam(query) {
  return query
    .populate('department', 'name color')
    .populate('lead', 'name employeeId photoUrl')
    .populate('members', 'name employeeId photoUrl');
}

router.get('/', async (req, res, next) => {
  try {
    const { department } = req.query;
    const filter = { organization: req.organizationId, archived: archivedFilter(req) };
    if (department) filter.department = department;
    const teams = await populateTeam(Team.find(filter).sort({ name: 1 })).lean();
    return ok(res, { teams });
  } catch (e) { next(e); }
});

router.get('/:id', async (req, res, next) => {
  try {
    const team = await populateTeam(Team.findOne({ _id: req.params.id, organization: req.organizationId })).lean();
    if (!team) throw new ApiError('Team not found', 404);
    return ok(res, { team });
  } catch (e) { next(e); }
});

const bodySchema = z.object({
  name: z.string().trim().min(1).max(120),
  department: z.string().nullable().optional(),
  lead: z.string().nullable().optional(),
  members: z.array(z.string()).optional().default([]),
  description: z.string().max(500).optional().default(''),
});

router.post('/', requireCompanyRole(HR_ROLES), validate(bodySchema), async (req, res, next) => {
  try {
    const team = await Team.create({ ...req.body, organization: req.organizationId });
    const populated = await populateTeam(Team.findById(team._id)).lean();
    return ok(res, { team: populated }, 'Team created', 201);
  } catch (e) { next(e); }
});

router.patch('/:id', requireCompanyRole(HR_ROLES), validate(bodySchema.partial()), async (req, res, next) => {
  try {
    const team = await populateTeam(
      Team.findOneAndUpdate({ _id: req.params.id, organization: req.organizationId }, req.body, { new: true })
    );
    if (!team) throw new ApiError('Team not found', 404);
    return ok(res, { team }, 'Team updated');
  } catch (e) { next(e); }
});

router.delete('/:id', requireCompanyRole(HR_ROLES), async (req, res, next) => {
  try {
    const team = await Team.findOneAndDelete({ _id: req.params.id, organization: req.organizationId });
    if (!team) throw new ApiError('Team not found', 404);
    return ok(res, null, 'Team deleted');
  } catch (e) { next(e); }
});

mountCrudExtensions(router, {
  Model: Team,
  requireCompanyRole,
  manageRoles: HR_ROLES,
  patchSchema: bodySchema.partial(),
  resourceName: 'Team',
  beforeDuplicate: async (obj, attempt) => {
    obj.name = attempt === 0 ? `Copy of ${obj.name}` : `Copy of ${obj.name} (${attempt + 1})`;
    return obj;
  },
});

module.exports = router;
