const { z } = require('zod');
const { validate } = require('../middleware/validate');
const { ok, ApiError } = require('./respond');

const idsSchema = z.object({ ids: z.array(z.string()).min(1) });

/**
 * Default archived-visibility filter for list (`GET /`) routes:
 * `?archived=true` shows only archived records, otherwise only non-archived
 * ones (matches records with no `archived` field too, via $ne).
 */
function archivedFilter(req) {
  return req.query.archived === 'true' ? true : { $ne: true };
}

/**
 * Mounts the shared archive/restore/duplicate/bulk-* routes shared by every
 * org-scoped, table-based module, so this isn't hand-duplicated per resource.
 *
 * opts:
 *   Model             - Mongoose model
 *   requireCompanyRole - the auth middleware factory
 *   manageRoles       - roles[] allowed to archive/restore/delete/duplicate/bulk-edit
 *   patchSchema       - optional zod schema (already .partial()) validating the
 *                        `patch` body of POST /bulk-update; omit to skip that route
 *   beforeDuplicate   - optional async (plainObj, attempt, req) => plainObj,
 *                        for model-specific duplicate prep (regenerating unique
 *                        fields, renaming on collision retry, clearing serials, etc.)
 *   resourceName      - singular label used in toast messages, e.g. "Asset"
 */
function mountCrudExtensions(router, opts) {
  const { Model, requireCompanyRole, manageRoles, patchSchema, beforeDuplicate, resourceName = 'Record' } = opts;

  router.patch('/:id/archive', requireCompanyRole(manageRoles), async (req, res, next) => {
    try {
      const doc = await Model.findOneAndUpdate(
        { _id: req.params.id, organization: req.organizationId },
        { archived: true, archivedAt: new Date() },
        { new: true }
      );
      if (!doc) throw new ApiError(`${resourceName} not found`, 404);
      return ok(res, { record: doc }, `${resourceName} archived`);
    } catch (e) { next(e); }
  });

  router.patch('/:id/restore', requireCompanyRole(manageRoles), async (req, res, next) => {
    try {
      const doc = await Model.findOneAndUpdate(
        { _id: req.params.id, organization: req.organizationId },
        { archived: false, archivedAt: null },
        { new: true }
      );
      if (!doc) throw new ApiError(`${resourceName} not found`, 404);
      return ok(res, { record: doc }, `${resourceName} restored`);
    } catch (e) { next(e); }
  });

  router.post('/:id/duplicate', requireCompanyRole(manageRoles), async (req, res, next) => {
    try {
      const source = await Model.findOne({ _id: req.params.id, organization: req.organizationId }).lean();
      if (!source) throw new ApiError(`${resourceName} not found`, 404);
      delete source._id;
      delete source.createdAt;
      delete source.updatedAt;
      delete source.__v;
      source.organization = req.organizationId;
      source.archived = false;
      source.archivedAt = null;

      let created = null;
      let lastErr = null;
      for (let attempt = 0; attempt < 5 && !created; attempt++) {
        let obj = { ...source };
        if (beforeDuplicate) obj = await beforeDuplicate(obj, attempt, req);
        try {
          created = await Model.create(obj);
        } catch (e) {
          if (e.code === 11000 && attempt < 4) { lastErr = e; continue; }
          throw e;
        }
      }
      if (!created) throw lastErr || new ApiError(`Could not duplicate ${resourceName.toLowerCase()}`, 500);
      return ok(res, { record: created }, `${resourceName} duplicated`, 201);
    } catch (e) { next(e); }
  });

  router.post('/bulk-delete', requireCompanyRole(manageRoles), validate(idsSchema), async (req, res, next) => {
    try {
      const result = await Model.deleteMany({ _id: { $in: req.body.ids }, organization: req.organizationId });
      return ok(res, { deletedCount: result.deletedCount }, `${result.deletedCount} ${resourceName.toLowerCase()}(s) deleted`);
    } catch (e) { next(e); }
  });

  router.post('/bulk-archive', requireCompanyRole(manageRoles), validate(idsSchema), async (req, res, next) => {
    try {
      const result = await Model.updateMany(
        { _id: { $in: req.body.ids }, organization: req.organizationId },
        { archived: true, archivedAt: new Date() }
      );
      return ok(res, { modifiedCount: result.modifiedCount }, `${result.modifiedCount} ${resourceName.toLowerCase()}(s) archived`);
    } catch (e) { next(e); }
  });

  router.post('/bulk-restore', requireCompanyRole(manageRoles), validate(idsSchema), async (req, res, next) => {
    try {
      const result = await Model.updateMany(
        { _id: { $in: req.body.ids }, organization: req.organizationId },
        { archived: false, archivedAt: null }
      );
      return ok(res, { modifiedCount: result.modifiedCount }, `${result.modifiedCount} ${resourceName.toLowerCase()}(s) restored`);
    } catch (e) { next(e); }
  });

  if (patchSchema) {
    const bulkUpdateSchema = z.object({ ids: z.array(z.string()).min(1), patch: patchSchema });
    router.post('/bulk-update', requireCompanyRole(manageRoles), validate(bulkUpdateSchema), async (req, res, next) => {
      try {
        const { ids, patch } = req.body;
        const result = await Model.updateMany({ _id: { $in: ids }, organization: req.organizationId }, patch);
        return ok(res, { modifiedCount: result.modifiedCount }, `${result.modifiedCount} ${resourceName.toLowerCase()}(s) updated`);
      } catch (e) { next(e); }
    });
  }
}

module.exports = { mountCrudExtensions, archivedFilter };
