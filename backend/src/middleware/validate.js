const { z } = require('zod');
const { ApiError } = require('../utils/respond');

/**
 * Validate req[source] against a Zod schema.
 * Replaces req[source] with the parsed object on success.
 */
function validate(schema, source = 'body') {
  return (req, _res, next) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      }));
      return next(new ApiError('Validation failed', 400, details));
    }
    req[source] = result.data;
    next();
  };
}

// Shared param-shape check for the common `/:id` route pattern. Mongoose
// already CastErrors on a malformed ObjectId (caught safely by the central
// error handler), so this isn't closing an injection hole — it's making the
// rejection explicit/early rather than relying on that fallback everywhere.
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const idParamSchema = z.object({ id: objectIdSchema });

module.exports = { validate, idParamSchema, objectIdSchema };
