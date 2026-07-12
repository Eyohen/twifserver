// src/middleware/rateLimiter.js
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const Redis = require('ioredis');
const config = require('../config');

// Create Redis client
let redisClient;
try {
  redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: process.env.REDIS_PORT || 6379,
    password: process.env.REDIS_PASSWORD,
    enableOfflineQueue: false,
    retryStrategy: (times) => {
      if (times > 3) {
        console.warn('Redis connection failed, falling back to memory store');
        return null;
      }
      return Math.min(times * 100, 3000);
    }
  });

  redisClient.on('error', (error) => {
    console.error('Redis error:', error);
  });
} catch (error) {
  console.warn('Redis initialization failed, will use memory store:', error);
}

/**
 * Creates a rate limiter middleware with specified options
 * @param {Object} options Rate limiting options
 * @param {number} options.windowMs Time window in milliseconds
 * @param {number} options.max Maximum number of requests in the time window
 * @param {string} options.keyPrefix Prefix for Redis keys
 * @returns {Function} Rate limiter middleware
 */
const createRateLimiter = (options = {}) => {
  const defaultOptions = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    keyPrefix: 'rl:', // Redis key prefix
    message: {
      success: false,
      message: 'Too many requests, please try again later'
    }
  };

  const config = { ...defaultOptions, ...options };

  // If Redis client is available and healthy, use Redis store
  if (redisClient && redisClient.status === 'ready') {
    return rateLimit({
      ...config,
      store: new RedisStore({
        client: redisClient,
        prefix: config.keyPrefix,
        // Optional: implement a custom increment function
        increment: async (key) => {
          const multi = redisClient.multi();
          multi.incr(key);
          multi.pexpire(key, config.windowMs);
          const [count] = await multi.exec();
          return count;
        }
      })
    });
  }

  // Fallback to memory store if Redis is not available
  return rateLimit(config);
};

// Check if we're in development mode
const isDevelopment = process.env.NODE_ENV !== 'production';

// Predefined rate limiters for different use cases
const rateLimiters = {
  // Rate limit for authentication endpoints (relaxed in development)
  auth: createRateLimiter({
    windowMs: isDevelopment ? 15 * 60 * 1000 : 60 * 60 * 1000, // 15 min in dev, 1 hour in prod
    max: isDevelopment ? 100 : 20, // 100 in dev, 20 in prod
    keyPrefix: 'rl:auth:',
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later'
    }
  }),

  // Standard API endpoint limit
  api: createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    keyPrefix: 'rl:api:'
  }),

  // Relaxed limit for webhook endpoints
  webhook: createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 30, // 30 requests per minute
    keyPrefix: 'rl:webhook:'
  }),

  // Custom rate limiter factory
  custom: createRateLimiter
};

// IP-based rate limiting middleware
const ipRateLimiter = (req, res, next) => {
  const clientIp = req.ip || 
    req.connection.remoteAddress || 
    req.socket.remoteAddress || 
    req.connection.socket.remoteAddress;

  const key = `rate-limit:${clientIp}`;
  
  if (redisClient && redisClient.status === 'ready') {
    redisClient.multi()
      .incr(key)
      .pexpire(key, 60000) // 1 minute window
      .exec((err, replies) => {
        if (err) {
          console.error('Rate limiting error:', err);
          return next();
        }

        const requests = replies[0][1];
        if (requests > 100) { // 100 requests per minute
          return res.status(429).json({
            success: false,
            message: 'Too many requests from this IP'
          });
        }
        next();
      });
  } else {
    // Fallback to simple in-memory rate limiting
    next();
  }
};

// Merchant-specific rate limiting middleware
const merchantRateLimiter = (req, res, next) => {
  const merchantId = req.merchant?.id;
  if (!merchantId) return next();

  const key = `rate-limit:merchant:${merchantId}`;
  
  if (redisClient && redisClient.status === 'ready') {
    redisClient.multi()
      .incr(key)
      .pexpire(key, 60000) // 1 minute window
      .exec((err, replies) => {
        if (err) {
          console.error('Merchant rate limiting error:', err);
          return next();
        }

        const requests = replies[0][1];
        if (requests > 200) { // 200 requests per minute per merchant
          return res.status(429).json({
            success: false,
            message: 'Rate limit exceeded for this merchant'
          });
        }
        next();
      });
  } else {
    // Fallback to simple in-memory rate limiting
    next();
  }
};

module.exports = {
  rateLimiters,
  ipRateLimiter,
  merchantRateLimiter,
  createRateLimiter
};

// Example usage in routes:
/*
const { rateLimiters } = require('../middleware/rateLimiter');

// Use predefined limiters
router.post('/auth', rateLimiters.auth, authController.login);
router.post('/api/payments', rateLimiters.api, paymentController.create);

// Or create custom limiter
const customLimiter = rateLimiters.custom({
  windowMs: 30 * 60 * 1000, // 30 minutes
  max: 50 // 50 requests per 30 minutes
});
router.post('/custom-endpoint', customLimiter, customController.handle);
*/