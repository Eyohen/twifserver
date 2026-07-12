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

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
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

app.use('/api/auth', authRoutes);
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
