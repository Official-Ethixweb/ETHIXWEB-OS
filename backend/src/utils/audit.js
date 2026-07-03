const AuditLog = require('../models/AuditLog');
const logger = require('./logger');

// Fire-and-forget: an audit-log write must never block or fail the request
// it's recording. Call at the point a sensitive mutation succeeds.
async function logAudit(req, action, resourceType, resourceId, metadata = null) {
  try {
    await AuditLog.create({
      organization: req.organizationId,
      actor: req.user?.id || null,
      action,
      resourceType,
      resourceId: resourceId || null,
      metadata,
      ip: req.ip,
      userAgent: req.headers['user-agent'] || null,
    });
  } catch (e) {
    logger.error('Failed to write audit log', e);
  }
}

module.exports = { logAudit };
