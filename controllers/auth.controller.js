const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Op } = require('sequelize');
const db = require('../models');
const { User, PersonalProfile, BusinessProfile } = db;
const emailService = require('../services/email.service');

const ACCESS_TOKEN_EXPIRY = '1h';
const REFRESH_TOKEN_EXPIRY = '30d';
const REFRESH_COOKIE_MAX_AGE = 30 * 24 * 60 * 60 * 1000;

const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
  });

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
};

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
  maxAge: REFRESH_COOKIE_MAX_AGE,
  path: '/',
});

const getAccountType = (payload = {}) => payload.accountType || payload.userType;

const splitFullName = (fullName = '') => {
  const trimmedName = fullName.trim().replace(/\s+/g, ' ');
  if (!trimmedName) {
    return { firstName: '', lastName: '' };
  }

  const [firstName, ...rest] = trimmedName.split(' ');
  return {
    firstName,
    lastName: rest.join(' '),
  };
};

const createStarterProfileData = (payload) => {
  const accountType = getAccountType(payload);
  if (accountType === 'personal') {
    const derivedName = splitFullName(payload.fullName || '');
    const firstName = (payload.firstName || derivedName.firstName).trim();
    const lastName = (payload.lastName || derivedName.lastName).trim();

    return {
      firstName,
      lastName: lastName || null,
      displayName: payload.displayName?.trim() || payload.fullName?.trim() || `${firstName} ${lastName}`.trim() || firstName,
      phone: payload.phone?.trim() || null,
    };
  }

  const businessName = (payload.businessName || payload.companyName || payload.company || '').trim();
  const contactName = (payload.contactName || '').trim();
  return {
    businessName,
    contactName,
    phone: payload.phone?.trim() || null,
    website: payload.website?.trim() || null,
  };
};

const getStarterValidationError = (payload) => {
  const accountType = getAccountType(payload);
  if (accountType === 'personal') {
    const derivedName = splitFullName(payload.fullName || '');
    const firstName = (payload.firstName || derivedName.firstName).trim();

    if (!firstName) {
      return 'First name is required for personal accounts';
    }

    return null;
  }

  const businessName = (payload.businessName || payload.companyName || payload.company || '').trim();
  const contactName = (payload.contactName || '').trim();

  if (!businessName) {
    return 'Business name is required';
  }

  if (!contactName) {
    return 'Contact name is required';
  }

  return null;
};

const loadProfile = async (user) => {
  if (!user) {
    return null;
  }

  if (user.userType === 'personal') {
    return PersonalProfile.findOne({ where: { userId: user.id } });
  }

  if (user.userType === 'business') {
    return BusinessProfile.findOne({ where: { userId: user.id } });
  }

  return null;
};

const toPublicUser = (user, profile) => ({
  id: user.id,
  email: user.email,
  accountType: user.userType,
  status: user.status,
  verified: user.verified,
  onboardingCompleted: profile?.onboardingCompleted ?? user.onboardingCompleted,
  onboardingStep: profile?.onboardingStep ?? user.onboardingStep,
  createdAt: user.createdAt,
  lastLoginAt: user.lastLoginAt,
});

const sendLoginResponse = async (res, user) => {
  const profile = await loadProfile(user);
  const { accessToken, refreshToken } = generateTokens(user.id);

  await user.update({
    lastLoginAt: new Date(),
    refreshToken,
  });

  res.cookie('refreshToken', refreshToken, getCookieOptions());

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      accessToken,
      user: toPublicUser(user, profile),
      profile,
    },
  });
};

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;
    const accountType = getAccountType(req.body);
    const normalizedEmail = email.toLowerCase().trim();

    const starterValidationError = getStarterValidationError(req.body);
    if (starterValidationError) {
      return res.status(400).json({
        success: false,
        message: starterValidationError,
      });
    }

    const existingUser = await User.findOne({ where: { email: normalizedEmail } });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered',
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const user = await User.create({
      email: normalizedEmail,
      password: hashedPassword,
      userType: accountType,
      status: 'pending_verification',
      verified: false,
      verificationToken,
      verificationTokenExpires,
      onboardingCompleted: false,
      onboardingStep: 1,
    });

    const profileData = createStarterProfileData(req.body);
    const ProfileModel = accountType === 'personal' ? PersonalProfile : BusinessProfile;
    const profile = await ProfileModel.create({
      userId: user.id,
      ...profileData,
    });

    await emailService.sendVerificationEmail(user.email, verificationToken);

    return res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email to verify your account.',
      data: {
        user: toPublicUser(user, profile),
        profile,
      },
    });
  } catch (error) {
    console.error('Register error:', error);

    if (error.name === 'SequelizeDatabaseError' || error.name === 'SequelizeValidationError') {
      return res.status(500).json({
        success: false,
        message: error.message || 'Registration failed due to a database error',
        ...(process.env.NODE_ENV === 'development' ? { details: error.parent?.detail || error.parent?.message || error.stack } : {}),
      });
    }

    return res.status(error.status || 500).json({
      success: false,
      message: error.message || 'Registration failed',
      ...(process.env.NODE_ENV === 'development' ? { details: error.stack } : {}),
    });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email.toLowerCase().trim();

    const user = await User.findOne({ where: { email: normalizedEmail } });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials',
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        success: false,
        message: 'Account suspended. Please contact support.',
      });
    }

    if (!user.verified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email first',
        code: 'EMAIL_NOT_VERIFIED',
      });
    }

    return sendLoginResponse(res, user);
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
    });
  }
};

exports.logout = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (refreshToken) {
      const user = await User.findOne({ where: { refreshToken } });
      if (user) {
        await user.update({ refreshToken: null });
      }
    }
  } catch (error) {
    console.error('Logout cleanup error:', error);
  }

  res.clearCookie('refreshToken', getCookieOptions());
  res.json({
    success: true,
    message: 'Logged out successfully',
  });
};

exports.verifyEmail = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token required',
      });
    }

    const user = await User.findOne({
      where: { verificationToken: token },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    if (user.verified) {
      return res.json({
        success: true,
        message: 'Email already verified. You can now login.',
      });
    }

    if (!user.verificationTokenExpires || user.verificationTokenExpires <= new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token',
      });
    }

    await user.update({
      verified: true,
      status: 'active',
    });

    await emailService.sendWelcomeEmail(user.email);

    return res.json({
      success: true,
      message: 'Email verified successfully. You can now login.',
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({
      success: false,
      message: 'Email verification failed',
    });
  }
};

exports.resendVerification = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.json({
        success: true,
        message: 'If this email exists, a verification link has been sent.',
      });
    }

    if (user.verified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified',
      });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationTokenExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.update({
      verificationToken,
      verificationTokenExpires,
    });

    await emailService.sendVerificationEmail(email, verificationToken);

    return res.json({
      success: true,
      message: 'Verification email sent',
    });
  } catch (error) {
    console.error('Resend verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to send verification email',
    });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const email = req.body.email.toLowerCase().trim();
    const user = await User.findOne({ where: { email } });

    if (!user) {
      return res.json({
        success: true,
        message: 'If this email exists, a password reset link has been sent.',
      });
    }

    const resetPasswordToken = crypto.randomBytes(32).toString('hex');
    const resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000);

    await user.update({
      resetPasswordToken,
      resetPasswordExpires,
    });

    await emailService.sendPasswordResetEmail(email, resetPasswordToken);

    return res.json({
      success: true,
      message: 'Password reset email sent',
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to process request',
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    const user = await User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired reset token',
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    await user.update({
      password: hashedPassword,
      resetPasswordToken: null,
      resetPasswordExpires: null,
      refreshToken: null,
    });

    await emailService.sendPasswordChangedEmail(user.email);

    res.clearCookie('refreshToken', getCookieOptions());

    return res.json({
      success: true,
      message: 'Password reset successfully',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to reset password',
    });
  }
};

exports.googleAuth = async (req, res) => {
  res.status(501).json({
    success: false,
    message: 'Google OAuth is not included in the first Twif backend release.',
  });
};

exports.refreshToken = async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token required',
      });
    }

    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type',
      });
    }

    const user = await User.findByPk(decoded.userId);
    if (!user || user.status !== 'active' || user.refreshToken !== refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token',
      });
    }

    const tokens = generateTokens(user.id);
    await user.update({ refreshToken: tokens.refreshToken });

    res.cookie('refreshToken', tokens.refreshToken, getCookieOptions());

    return res.json({
      success: true,
      data: {
        accessToken: tokens.accessToken,
      },
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid refresh token',
    });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id);
    const profile = await loadProfile(user);

    return res.json({
      success: true,
      data: {
        user: toPublicUser(user, profile),
        profile,
      },
    });
  } catch (error) {
    console.error('Get current user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to get user data',
    });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findByPk(req.userId);

    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await user.update({
      password: hashedPassword,
      refreshToken: null,
    });

    await emailService.sendPasswordChangedEmail(user.email);

    res.clearCookie('refreshToken', getCookieOptions());

    return res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to change password',
    });
  }
};
