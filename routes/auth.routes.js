const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const authController = require('../controllers/auth.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validate, validations } = require('../middleware/validate.middleware');

// Auth-specific rate limiting (stricter for login/register to prevent brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Allow 20 attempts per 15 min
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true // Don't count successful requests
});

// Lenient rate limiting for token refresh (needs to work seamlessly)
const refreshLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Allow 10 refresh attempts per minute
  message: {
    success: false,
    message: 'Too many refresh attempts, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Public routes with rate limiting
router.post('/register',
  authLimiter,
  validations.register,
  validate,
  authController.register
);

router.post('/login',
  authLimiter,
  validations.login,
  validate,
  authController.login
);

router.post('/logout', authController.logout);

router.post('/forgot-password',
  validations.forgotPassword,
  validate,
  authController.forgotPassword
);

router.post('/reset-password',
  validations.resetPassword,
  validate,
  authController.resetPassword
);

router.get('/verify-email', authController.verifyEmail);

router.post('/resend-verification',
  validations.forgotPassword,
  validate,
  authController.resendVerification
);

// Google OAuth
router.post('/google', authController.googleAuth);

// Token refresh - with lenient rate limiting
router.post('/refresh-token', refreshLimiter, authController.refreshToken);

// Protected routes
router.get('/me', verifyToken, authController.getCurrentUser);

router.put('/change-password',
  verifyToken,
  validations.changePassword,
  validate,
  authController.changePassword
);

module.exports = router;
