// middleware/auditLogger.js
const auditLogService = require('../services/auditLog.service');

/**
 * Middleware to automatically log all API requests
 */
const auditLogger = (req, res, next) => {
  const startTime = Date.now();

  // Skip logging for health checks and audit dashboard to avoid spam
  if (req.path === '/api/health' || req.path.startsWith('/api/audit/')) {
    return next();
  }

  // Override res.end to capture response details
  const originalEnd = res.end;
  res.end = function(...args) {
    const responseTime = Date.now() - startTime;
    
    // Log the API call asynchronously to avoid blocking the response
    setImmediate(() => {
      auditLogService.logAPICall(req, res, responseTime).catch(err => {
        console.error('Failed to log API call:', err);
      });
    });

    originalEnd.apply(this, args);
  };

  next();
};

module.exports = auditLogger;