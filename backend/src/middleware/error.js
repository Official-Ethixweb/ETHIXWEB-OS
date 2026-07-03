const logger = require('../utils/logger');
const { ApiError } = require('../utils/respond');

function notFound(req, res) {
  res.status(404).json({ success: false, error: `Not found: ${req.method} ${req.originalUrl}`, message: 'Not found' });
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message || 'Internal server error';
  let details;
  let known = false;

  if (err.name === 'ValidationError') {
    status = 400;
    details = Object.values(err.errors || {}).map((e) => e.message);
    message = 'Validation failed';
    known = true;
  } else if (err.name === 'CastError') {
    status = 400;
    message = `Invalid ${err.path}: ${err.value}`;
    known = true;
  } else if (err.code === 11000) {
    status = 409;
    message = 'Duplicate value';
    details = err.keyValue;
    known = true;
  } else if (err instanceof ApiError) {
    details = err.details;
    known = true;
  }

  if (status >= 500) {
    logger.error(`${req.method} ${req.originalUrl} -> ${status}`, err);
  } else {
    logger.warn(`${req.method} ${req.originalUrl} -> ${status} ${message}`);
  }

  // Anything not explicitly recognized above is an unexpected failure (a bug,
  // a driver error, a third-party SDK error) — don't echo its raw message to
  // API consumers in production, only to server-side logs (above).
  if (!known && process.env.NODE_ENV === 'production') {
    message = 'Something went wrong. Please try again.';
  }

  res.status(status).json({
    success: false,
    error: message,
    message,
    ...(details ? { details } : {}),
  });
}

module.exports = { notFound, errorHandler };
