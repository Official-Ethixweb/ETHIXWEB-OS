const rateLimit = require('express-rate-limit');

function make(opts) {
  return rateLimit({
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests, please try again later.', message: 'Too many requests, please try again later.' },
    ...opts,
  });
}

// Applied globally in server.js to every /api-style route.
const globalLimiter = make({ windowMs: 15 * 60 * 1000, max: 300 });

// Login specifically: keyed by IP + attempted email so one IP hammering many
// accounts and one account being hammered from many IPs are both throttled.
const authLimiter = make({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `${req.ip}:${(req.body && req.body.email) || ''}`,
});

// Signup/forgot-password: looser than login but still bounded.
const accountLimiter = make({ windowMs: 15 * 60 * 1000, max: 20 });

// Mutating requests on sensitive modules (finance, payroll, invites).
const writeLimiter = make({ windowMs: 15 * 60 * 1000, max: 100 });

// File uploads — larger payloads, more expensive to process.
const uploadLimiter = make({ windowMs: 15 * 60 * 1000, max: 40 });

// PDF/CSV export endpoints — expensive to generate.
const exportLimiter = make({ windowMs: 15 * 60 * 1000, max: 30 });

module.exports = { globalLimiter, authLimiter, accountLimiter, writeLimiter, uploadLimiter, exportLimiter };
