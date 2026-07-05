require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const hpp = require('hpp');
const compression = require('compression');
const cookieParser = require('cookie-parser');

const { connectDB } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/error');
const logger = require('./utils/logger');
const { globalLimiter } = require('./middleware/rateLimit');

const authRoutes = require('./routes/auth');
const inviteRoutes = require('./routes/invites');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const userRoutes = require('./routes/users');
const employeeRoutes = require('./routes/employees');
const attendanceRoutes = require('./routes/attendance');
const leaveRoutes = require('./routes/leaves');
const payrollRoutes = require('./routes/payroll');
const subscriptionRoutes = require('./routes/subscriptions');
const domainRoutes = require('./routes/domains');
const serverRoutes = require('./routes/servers');
const financeRoutes = require('./routes/finance');
const assetRoutes = require('./routes/assets');
const clientRoutes = require('./routes/clients');
const vendorRoutes = require('./routes/vendors');
const departmentRoutes = require('./routes/departments');
const teamRoutes = require('./routes/teams');
const fileRoutes = require('./routes/files');
const organizationRoutes = require('./routes/organizations');
const roleRoutes = require('./routes/roles');
const auditLogRoutes = require('./routes/auditLog');
const dashboardLayoutRoutes = require('./routes/dashboardLayout');

const app = express();
const PORT = process.env.PORT || 4000;

const blobHost = (() => {
  try {
    return process.env.BLOB_READ_WRITE_TOKEN ? 'https://*.public.blob.vercel-storage.com' : null;
  } catch {
    return null;
  }
})();

app.set('trust proxy', 1); // required for req.ip / rate-limit keying behind Vercel/Railway's proxy

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", 'data:', ...(blobHost ? [blobHost] : [])],
        connectSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);
app.use(compression());

// --- CORS ---
const allowedOrigins = (process.env.CLIENT_ORIGIN || (process.env.NODE_ENV === 'production' ? '' : 'http://localhost:8080'))
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use((req, res, next) => {
  cors({
    origin: (origin, cb) => {
      // Allow REST tools / same-origin (no Origin header)
      if (!origin) return cb(null, true);
      const isSameHost = (() => {
        try {
          return new URL(origin).host === req.get('host');
        } catch {
          return false;
        }
      })();
      const isRailwayApp = (() => {
        try {
          return process.env.NODE_ENV === 'production' && new URL(origin).hostname.endsWith('.up.railway.app');
        } catch {
          return false;
        }
      })();
      if (isSameHost || isRailwayApp || allowedOrigins.includes('*') || allowedOrigins.includes(origin)) {
        return cb(null, true);
      }
      return cb(new Error(`CORS: origin ${origin} not allowed`));
    },
    credentials: true,
  })(req, res, next);
});

app.use(cookieParser());
app.use(express.json({ limit: '1mb' }));
app.use(mongoSanitize());
app.use(hpp());
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// On serverless hosts (Vercel), a fresh function invocation may not have a
// live Mongo connection yet; connectDB() is cached, so this is a no-op once
// warm. On persistent-process hosts (Railway/Render/Fly/local dev) the
// connection is already established below before the process ever starts
// listening, so this resolves instantly.
app.use((req, res, next) => {
  connectDB(process.env.MONGODB_URI).then(() => next(), next);
});

app.get('/health', (_req, res) =>
  res.json({
    success: true,
    data: {
      status: 'ok',
      uptime: process.uptime(),
      db: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    },
    message: 'TeamFlow API is running',
  })
);

// Global request budget. Tighter per-route limiters (login, signup, uploads,
// exports) are applied inside their own route files so legitimate high-frequency
// calls like /auth/me and /auth/refresh aren't caught by a blanket auth limit.
app.use(globalLimiter);

app.use('/auth', authRoutes);
app.use('/invites', inviteRoutes);
app.use('/projects', projectRoutes);
app.use('/tasks', taskRoutes);
app.use('/users', userRoutes);
app.use('/employees', employeeRoutes);
app.use('/attendance', attendanceRoutes);
app.use('/leaves', leaveRoutes);
app.use('/payroll', payrollRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/domains', domainRoutes);
app.use('/servers', serverRoutes);
app.use('/finance', financeRoutes);
app.use('/assets', assetRoutes);
app.use('/clients', clientRoutes);
app.use('/vendors', vendorRoutes);
app.use('/departments', departmentRoutes);
app.use('/teams', teamRoutes);
app.use('/files', fileRoutes);
app.use('/organizations', organizationRoutes);
app.use('/roles', roleRoutes);
app.use('/audit-log', auditLogRoutes);
app.use('/dashboard-layout', dashboardLayoutRoutes);

if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(frontendDistPath));
  const apiPrefixes = ['/auth', '/invites', '/projects', '/tasks', '/users', '/files', '/organizations', '/roles', '/audit-log', '/dashboard-layout'];
  app.get('*', (_req, res, next) => {
    if (apiPrefixes.some((p) => _req.path.startsWith(p))) {
      return next();
    }
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

// Only bind a persistent listener when this file is executed directly
// (Railway/Render/Fly/local `node src/server.js`). When Vercel's builder
// requires this file as a module for its Express service, `require.main !==
// module`, so we skip .listen() and just export the app as a request handler
// — the connectDB middleware above ensures the DB is ready per-request.
if (require.main === module) {
  connectDB(process.env.MONGODB_URI)
    .then(() => {
      app.listen(PORT, () => logger.info(`TeamFlow API listening on :${PORT}`));
    })
    .catch((err) => {
      logger.error('Failed to start server', err);
      process.exit(1);
    });
}

module.exports = app;
