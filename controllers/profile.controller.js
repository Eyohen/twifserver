const db = require('../models');

const { PersonalProfile, BusinessProfile } = db;

const PERSONAL_FIELDS = [
  'firstName',
  'lastName',
  'displayName',
  'headline',
  'bio',
  'phone',
  'avatarUrl',
  'website',
  'country',
  'state',
  'city',
  'address',
  'cvFileName',
  'cvFileUrl',
  'cvUploadedAt',
  'onboardingStep',
  'onboardingCompleted',
  'onboardingCompletedAt',
];

const BUSINESS_FIELDS = [
  'businessName',
  'contactName',
  'businessType',
  'industry',
  'website',
  'phone',
  'logoUrl',
  'description',
  'country',
  'state',
  'city',
  'address',
  'onboardingStep',
  'onboardingCompleted',
  'onboardingCompletedAt',
];

const pickAllowedFields = (payload, allowedFields) =>
  allowedFields.reduce((accumulator, field) => {
    if (Object.prototype.hasOwnProperty.call(payload, field)) {
      accumulator[field] = payload[field];
    }
    return accumulator;
  }, {});

const updateUserOnboardingState = async (user, profile) => {
  await user.update({
    onboardingCompleted: profile.onboardingCompleted,
    onboardingStep: profile.onboardingStep,
  });
};

const getCurrentProfile = async (req, res) => {
  try {
    const profile = req.user.userType === 'personal'
      ? await PersonalProfile.findOne({ where: { userId: req.user.id } })
      : await BusinessProfile.findOne({ where: { userId: req.user.id } });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found',
      });
    }

    return res.json({
      success: true,
      data: {
        accountType: req.user.userType,
        profile,
      },
    });
  } catch (error) {
    console.error('Get current profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load profile',
    });
  }
};

const updatePersonalProfile = async (req, res) => {
  try {
    if (req.user.userType !== 'personal') {
      return res.status(403).json({
        success: false,
        message: 'Personal account access required',
      });
    }

    const profile = await PersonalProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Personal profile not found',
      });
    }

    const updates = pickAllowedFields(req.body, PERSONAL_FIELDS);
    await profile.update(updates);
    await updateUserOnboardingState(req.user, profile);

    return res.json({
      success: true,
      message: 'Personal profile updated successfully',
      data: profile,
    });
  } catch (error) {
    console.error('Update personal profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update personal profile',
    });
  }
};

const updateBusinessProfile = async (req, res) => {
  try {
    if (req.user.userType !== 'business') {
      return res.status(403).json({
        success: false,
        message: 'Business account access required',
      });
    }

    const profile = await BusinessProfile.findOne({ where: { userId: req.user.id } });
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Business profile not found',
      });
    }

    const updates = pickAllowedFields(req.body, BUSINESS_FIELDS);
    await profile.update(updates);
    await updateUserOnboardingState(req.user, profile);

    return res.json({
      success: true,
      message: 'Business profile updated successfully',
      data: profile,
    });
  } catch (error) {
    console.error('Update business profile error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update business profile',
    });
  }
};

module.exports = {
  getCurrentProfile,
  updatePersonalProfile,
  updateBusinessProfile,
};
