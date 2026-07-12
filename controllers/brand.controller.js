const db = require('../models');
const { Brand, User, Industry, SavedCreator, Creator, CollaborationRequest } = db;

// Get onboarding status
exports.getOnboardingStatus = async (req, res) => {
  try {
    const brand = req.brand;
    res.json({
      success: true,
      data: {
        currentStep: brand.onboardingStep,
        completed: brand.onboardingCompleted,
        completedAt: brand.onboardingCompletedAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get status' });
  }
};

// Save onboarding step
exports.saveOnboardingStep = async (req, res) => {
  try {
    const brand = req.brand;
    const { step } = req.params;
    const data = req.body;
    const stepNum = parseInt(step);

    console.log('Saving onboarding step:', stepNum, data);
    

    switch (stepNum) {
      case 1: // Company Info
        // Map companySize to businessType
        let businessType = null;
        if (data.companySize) {
          const sizeMap = {
            '1-10': 'startup',
            '11-50': 'sme',
            '51-200': 'sme',
            '201-500': 'enterprise',
            '500+': 'enterprise'
          };
          businessType = sizeMap[data.companySize] || 'startup';
        }

        await brand.update({
          companyName: data.companyName,
          industryId: data.industryId || null,
          businessType: businessType,
          description: data.description,
          website: data.website,
          stateId: data.stateId || null,
          cityId: data.cityId || null,
          onboardingStep: Math.max(brand.onboardingStep || 1, 2)
        });
        break;
      case 2: // Contact Info
        // Parse contact name into first/last name
        const nameParts = (data.contactName || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        await brand.update({
          contactFirstName: firstName,
          contactLastName: lastName,
          contactPosition: data.contactTitle,
          phone: data.contactPhone,
          onboardingStep: Math.max(brand.onboardingStep || 1, 3)
        });
        break;
      case 3: // Preferences
        await brand.update({
          monthlyBudget: data.budgetMax || null,
          preferredNiches: data.preferredCategories || [],
          onboardingStep: Math.max(brand.onboardingStep || 1, 4)
        });
        break;
      case 4: // Verification (optional)
        if (data.cacNumber) {
          await brand.update({
            cacNumber: data.cacNumber,
            cacRegistered: true,
            verificationStatus: 'pending'
          });
        }
        break;
      default:
        return res.status(400).json({ success: false, message: 'Invalid step' });
    }

    res.json({ success: true, message: 'Step saved', data: { currentStep: brand.onboardingStep } });
  } catch (error) {
    console.error('Save onboarding step error:', error);
    res.status(500).json({ success: false, message: 'Failed to save step' });
  }
};

// Complete onboarding
exports.completeOnboarding = async (req, res) => {
  try {
    const brand = req.brand;
    if (brand.onboardingStep < 3) {
      return res.status(400).json({ success: false, message: 'Complete required steps first' });
    }
    await brand.update({ onboardingCompleted: true, onboardingCompletedAt: new Date() });
    res.json({ success: true, message: 'Onboarding completed' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to complete' });
  }
};

// Get my profile
exports.getMyProfile = async (req, res) => {
  try {
    const brand = await Brand.findByPk(req.brand.id, {
      include: [
        { model: User, as: 'user', attributes: ['email', 'createdAt'] },
        { model: Industry, as: 'industry' }
      ]
    });
    res.json({ success: true, data: brand });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get profile' });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const allowedFields = ['companyName', 'description', 'website', 'industryId', 'contactName', 'contactEmail', 'contactPhone', 'monthlyBudget'];
    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    }
    await req.brand.update(updates);
    res.json({ success: true, message: 'Profile updated', data: req.brand });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

// Update logo
exports.updateLogo = async (req, res) => {
  try {
    const { logoUrl } = req.body;
    await req.brand.update({ logo: logoUrl });
    res.json({ success: true, message: 'Logo updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update logo' });
  }
};

// Get saved creators
exports.getSavedCreators = async (req, res) => {
  try {
    const saved = await SavedCreator.findAll({
      where: { brandId: req.brand.id },
      include: [{ model: Creator, as: 'creator' }]
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get saved' });
  }
};

// Save creator
exports.saveCreator = async (req, res) => {
  try {
    const { creatorId } = req.params;
    const [saved] = await SavedCreator.findOrCreate({
      where: { brandId: req.brand.id, creatorId },
      defaults: { brandId: req.brand.id, creatorId }
    });
    res.json({ success: true, data: saved });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to save' });
  }
};

// Unsave creator
exports.unsaveCreator = async (req, res) => {
  try {
    await SavedCreator.destroy({ where: { brandId: req.brand.id, creatorId: req.params.creatorId } });
    res.json({ success: true, message: 'Removed from saved' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to unsave' });
  }
};

// Update saved creator notes
exports.updateSavedCreatorNotes = async (req, res) => {
  try {
    const saved = await SavedCreator.findOne({ where: { brandId: req.brand.id, creatorId: req.params.creatorId } });
    if (!saved) return res.status(404).json({ success: false, message: 'Not found' });
    await saved.update({ notes: req.body.notes });
    res.json({ success: true, message: 'Notes updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

// Get dashboard stats
exports.getDashboardStats = async (req, res) => {
  try {
    const brand = req.brand;
    const activeRequests = await CollaborationRequest.count({ where: { brandId: brand.id, status: { [db.Sequelize.Op.notIn]: ['completed', 'cancelled', 'declined'] } } });
    const completedDeals = await CollaborationRequest.count({ where: { brandId: brand.id, status: 'completed' } });
    res.json({
      success: true,
      data: {
        activeRequests,
        completedDeals,
        totalSpent: brand.totalSpent,
        tier: brand.tier,
        messagesUsed: brand.messagesUsedThisMonth,
        messageLimit: brand.monthlyMessageLimit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};

// Get campaign stats
exports.getCampaignStats = async (req, res) => {
  try {
    // TODO: Implement campaign analytics
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};

// Get usage stats
exports.getUsageStats = async (req, res) => {
  try {
    const brand = req.brand;
    res.json({
      success: true,
      data: {
        messagesUsed: brand.messagesUsedThisMonth,
        messageLimit: brand.monthlyMessageLimit,
        activeCampaigns: brand.activeCampaigns,
        campaignLimit: brand.activeCampaignLimit
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get usage' });
  }
};

// Get subscription
exports.getSubscription = async (req, res) => {
  try {
    const brand = req.brand;
    res.json({
      success: true,
      data: {
        tier: brand.tier,
        subscriptionStatus: brand.subscriptionStatus,
        subscriptionEndsAt: brand.subscriptionEndsAt
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get subscription' });
  }
};

// Initiate upgrade
exports.initiateUpgrade = async (req, res) => {
  try {
    // TODO: Implement subscription upgrade via Paystack
    res.status(501).json({ success: false, message: 'Not implemented' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to initiate upgrade' });
  }
};
