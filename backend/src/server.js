require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const mongoose = require('mongoose');
const rateLimit = require('express-rate-limit');

const { connectDB } = require('./config/db');
const { errorHandler, notFound } = require('./middleware/error');
const logger = require('./utils/logger');

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
const { UPLOAD_ROOT } = require('./middleware/upload');

const app = express();
const PORT = process.env.PORT || 4000;

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

app.use(express.json({ limit: '1mb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

// Basic rate limit on auth to prevent brute-force
app.use(
  '/auth',
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

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

app.use('/uploads', express.static(UPLOAD_ROOT));

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

if (process.env.NODE_ENV === 'production') {
  const frontendDistPath = path.resolve(__dirname, '../../dist');
  app.use(express.static(frontendDistPath));
  app.get('*', (_req, res, next) => {
    if (_req.path.startsWith('/auth') || _req.path.startsWith('/invites') || _req.path.startsWith('/projects') || _req.path.startsWith('/tasks') || _req.path.startsWith('/users')) {
      return next();
    }
    return res.sendFile(path.join(frontendDistPath, 'index.html'));
  });
}

app.use(notFound);
app.use(errorHandler);

connectDB(process.env.MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => logger.info(`TeamFlow API listening on :${PORT}`));
  })
  .catch((err) => {
    logger.error('Failed to start server', err);
    process.exit(1);
  });
