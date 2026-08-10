require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const db = require('./models');

const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const discoverRoutes = require('./routes/discover.routes');
const connectionsRoutes = require('./routes/connections.routes');
const opportunitiesRoutes = require('./routes/opportunities.routes');
const notificationRoutes = require('./routes/notification.routes');
const bookingsRoutes = require('./routes/bookings.routes');
const adminRoutes = require('./routes/admin.routes');
const messageRoutes = require('./routes/message.routes');
const omsRoutes = require('./routes/oms.routes');

const app = express();

const configuredOrigins = [
  process.env.FRONTEND_URL,
  process.env.CLIENT_URL,
]
  .filter(Boolean)
  .flatMap((value) => value.split(','))
  .map((value) => value.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'http://localhost:5173',
  'http://localhost:5174',
  'https://twif.ng',
  'https://www.twif.ng',
  'https://twifinvoiceredesign2.netlify.app',
  ...configuredOrigins,
]);

app.set('trust proxy', 1);

app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

// Limits are per IP, and Railway sits behind a proxy, so a shop where several
// staff share one connection counts as a single client. The notification bell
// alone polls 45 times per window per open tab, so 200 was low enough that
// normal use in a two-store business tripped it — the UI then shows empty
// lists and "Too many requests" during the working day.
app.use(rateLimit({
  // The general ceiling is there for the open internet. Throttling a local run
  // only makes an automated check look like a product fault; the sign-in limit
  // below is not skipped, because that is the one that matters.
  skip: () => process.env.NODE_ENV !== 'production',
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX) || 2000,
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Twif API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Credential endpoints keep a tight limit of their own, so raising the general
// ceiling for everyday polling does not also widen the door to brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.AUTH_RATE_LIMIT_MAX) || 30,
  message: {
    success: false,
    message: 'Too many sign-in attempts. Please wait and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Staff sign-in had no limit of its own: seven phone numbers are easy to guess
// and a PIN is short, so it was open to being tried repeatedly until one fit.
const staffLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.STAFF_LOGIN_RATE_LIMIT_MAX) || 12,
  skipSuccessfulRequests: true,
  message: {
    success: false,
    message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/oms/auth/login', staffLoginLimiter);
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/discover', discoverRoutes);
app.use('/api/connections', connectionsRoutes);
app.use('/api/opportunities', opportunitiesRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/oms', omsRoutes);

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Endpoint not found',
  });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);

  if (err.name === 'SequelizeValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation error',
      errors: err.errors.map((error) => ({
        field: error.path,
        message: error.message,
      })),
    });
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({
      success: false,
      message: 'Resource already exists',
      errors: err.errors.map((error) => ({
        field: error.path,
        message: error.message,
      })),
    });
  }

  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token',
    });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      message: 'Token expired',
    });
  }

  return res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

const PORT = process.env.API_PORT || 8082;

const startServer = async () => {
  try {
    await db.sequelize.authenticate();
    console.log('Database connection established successfully');

    if (process.env.NODE_ENV === 'development') {
      await db.sequelize.sync({ alter: true });
      console.log('Database models synced');
    } else if (process.env.SKIP_SCHEMA_CHECK !== 'true') {
      // Deploys run `node index.js`, not the migrations, and production has no
      // SequelizeMeta table — so a model added to the repo never reaches the
      // database and its routes fail at runtime. A plain sync() issues
      // CREATE TABLE IF NOT EXISTS: it adds what is missing and never alters
      // or drops an existing table, so live data is untouched.
      const before = await db.sequelize.getQueryInterface().showAllTables();
      await db.sequelize.sync();
      const after = await db.sequelize.getQueryInterface().showAllTables();
      const created = after.filter((table) => !before.includes(table));
      console.log(created.length
        ? `Schema check created missing tables: ${created.join(', ')}`
        : 'Schema check: no missing tables');

      // sync() leaves an existing table exactly as it found it, so a column
      // added to a model that already has a table in production never arrives.
      // Missing columns are added one at a time — only ever added, so a column
      // holding live data is never altered, renamed or dropped.
      const queryInterface = db.sequelize.getQueryInterface();
      const addedColumns = [];
      for (const model of Object.values(db.sequelize.models)) {
        const tableName = model.getTableName();
        if (created.includes(tableName)) continue;
        let existing;
        try {
          existing = await queryInterface.describeTable(tableName);
        } catch {
          continue;
        }
        for (const [name, attribute] of Object.entries(model.rawAttributes)) {
          const column = attribute.field || name;
          if (existing[column]) continue;
          // A NOT NULL column cannot be added to a table with rows in it unless
          // it brings a default, so it goes in as nullable and the model keeps
          // enforcing the rule for new writes.
          const definition = { ...attribute };
          delete definition.field;
          if (definition.allowNull === false && definition.defaultValue === undefined) definition.allowNull = true;
          await queryInterface.addColumn(tableName, column, definition);
          addedColumns.push(`${tableName}.${column}`);
        }
      }
      console.log(addedColumns.length
        ? `Schema check added missing columns: ${addedColumns.join(', ')}`
        : 'Schema check: no missing columns');
    }

    app.listen(PORT, () => {
      console.log(`
========================================
         TWIF API SERVER
========================================
    Port: ${PORT}
    Environment: ${process.env.NODE_ENV || 'development'}
    API Base: http://localhost:${PORT}/api
========================================
      `);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  await db.sequelize.close();
  process.exit(0);
});

startServer();

module.exports = { app };
