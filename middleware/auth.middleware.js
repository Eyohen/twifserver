const jwt = require('jsonwebtoken');
const db = require('../models');
const { User, PersonalProfile, BusinessProfile } = db;

// Verify JWT token
const verifyToken = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] }
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found'
        });
      }

      if (user.status !== 'active') {
        return res.status(403).json({
          success: false,
          message: 'Account is not active'
        });
      }

      req.user = user;
      req.userId = user.id;
      req.userType = user.userType;
      next();
    } catch (error) {
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Token expired',
          code: 'TOKEN_EXPIRED'
        });
      }
      throw error;
    }
  } catch (error) {
    console.error('Auth middleware error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
};

// Optional auth - attach user if token present but don't require it
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findByPk(decoded.userId, {
        attributes: { exclude: ['password'] }
      });

      if (user && user.status === 'active') {
        req.user = user;
        req.userId = user.id;
        req.userType = user.userType;
      }
    } catch (error) {
      // Token invalid but that's okay for optional auth
    }

    next();
  } catch (error) {
    next();
  }
};

// Require specific user type
const requireUserType = (...allowedTypes) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    if (!allowedTypes.includes(req.user.userType)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied for your account type'
      });
    }

    next();
  };
};

// Require email verification
const requireEmailVerified = (req, res, next) => {
  if (!req.user.verified) {
    return res.status(403).json({
      success: false,
      message: 'Email verification required',
      code: 'EMAIL_NOT_VERIFIED'
    });
  }
  next();
};

// Require onboarding completed
const requireOnboardingComplete = async (req, res, next) => {
  try {
    const profile = req.user.userType === 'personal'
      ? await PersonalProfile.findOne({ where: { userId: req.user.id } })
      : await BusinessProfile.findOne({ where: { userId: req.user.id } });

    if (!profile || !profile.onboardingCompleted) {
      return res.status(403).json({
        success: false,
        message: 'Please complete onboarding first',
        code: 'ONBOARDING_REQUIRED',
        onboardingStep: profile?.onboardingStep || 1
      });
    }

    next();
  } catch (error) {
    console.error('Onboarding check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
};

module.exports = {
  verifyToken,
  optionalAuth,
  requireUserType,
  requireEmailVerified,
  requireOnboardingComplete
};
