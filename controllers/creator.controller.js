const { Op } = require('sequelize');
const db = require('../models');
const {
  Creator, User, SocialAccount, PortfolioItem, RateCard,
  ServicePackage, AvailabilitySlot, LegalClause, Category,
  State, City, Region, Review, CollaborationRequest
} = db;

// Search creators (public)
exports.searchCreators = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      category,
      state,
      city,
      platform,
      minPrice,
      maxPrice,
      minFollowers,
      maxFollowers,
      minRating,
      verified,
      available,
      sort = 'relevance',
      q // search query
    } = req.query;

    const offset = (page - 1) * limit;
    const where = {};
    const include = [
      { model: User, as: 'user', attributes: ['email', 'status'], where: { status: 'active', onboardingCompleted: true } },
      { model: State, as: 'state', include: [{ model: Region, as: 'region' }] },
      { model: City, as: 'city' }
    ];

    // Search query
    if (q) {
      where[Op.or] = [
        { displayName: { [Op.iLike]: `%${q}%` } },
        { bio: { [Op.iLike]: `%${q}%` } }
      ];
    }

    // Category filter
    if (category) {
      where.primaryNicheId = category;
    }

    // Location filters
    if (state) where.stateId = state;
    if (city) where.cityId = city;

    // Verification filter
    if (verified === 'true') {
      where.verificationStatus = 'verified';
    }

    // Availability filter
    if (available === 'true') {
      where.isAvailable = true;
    }

    // Rating filter
    if (minRating) {
      where.averageRating = { [Op.gte]: parseFloat(minRating) };
    }

    // Follower filter
    if (minFollowers) {
      where.totalFollowers = { ...where.totalFollowers, [Op.gte]: parseInt(minFollowers) };
    }
    if (maxFollowers) {
      where.totalFollowers = { ...where.totalFollowers, [Op.lte]: parseInt(maxFollowers) };
    }

    // Sorting
    let order = [['createdAt', 'DESC']];
    switch (sort) {
      case 'rating':
        order = [['averageRating', 'DESC']];
        break;
      case 'followers':
        order = [['totalFollowers', 'DESC']];
        break;
      case 'price_low':
        order = [['startingPrice', 'ASC']];
        break;
      case 'price_high':
        order = [['startingPrice', 'DESC']];
        break;
      case 'newest':
        order = [['createdAt', 'DESC']];
        break;
    }

    const { rows: creators, count } = await Creator.findAndCountAll({
      where,
      include,
      limit: parseInt(limit),
      offset,
      order,
      distinct: true
    });

    res.json({
      success: true,
      data: {
        creators,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: count,
          totalPages: Math.ceil(count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Search creators error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to search creators'
    });
  }
};

// Get creator public profile
exports.getCreatorPublicProfile = async (req, res) => {
  try {
    const { id } = req.params;

    const creator = await Creator.findByPk(id, {
      include: [
        { model: User, as: 'user', attributes: ['email', 'createdAt', 'onboardingCompleted'] },
        { model: State, as: 'state', include: [{ model: Region, as: 'region' }] },
        { model: City, as: 'city' },
        { model: SocialAccount, as: 'socialAccounts', where: { isActive: true }, required: false },
        { model: PortfolioItem, as: 'portfolio', where: { isPublic: true }, required: false, order: [['displayOrder', 'ASC']] },
        { model: RateCard, as: 'rateCards', where: { isActive: true }, required: false }
      ]
    });

    if (!creator || !creator.user?.onboardingCompleted) {
      return res.status(404).json({
        success: false,
        message: 'Creator not found'
      });
    }

    // Increment profile views
    await creator.increment('profileViews');

    res.json({
      success: true,
      data: creator
    });
  } catch (error) {
    console.error('Get creator profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get creator profile'
    });
  }
};

// Get creator portfolio
exports.getCreatorPortfolio = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 20 } = req.query;

    const portfolio = await PortfolioItem.findAndCountAll({
      where: { creatorId: id, isActive: true },
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      order: [['displayOrder', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        items: portfolio.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: portfolio.count,
          totalPages: Math.ceil(portfolio.count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get creator portfolio error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get portfolio'
    });
  }
};

// Get creator reviews
exports.getCreatorReviews = async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10 } = req.query;

    const reviews = await Review.findAndCountAll({
      where: { revieweeId: id },
      include: [
        { model: User, as: 'reviewer', attributes: ['id'] },
        { model: db.Brand, as: 'reviewerBrand', attributes: ['companyName', 'logo'] }
      ],
      limit: parseInt(limit),
      offset: (page - 1) * limit,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        reviews: reviews.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: reviews.count,
          totalPages: Math.ceil(reviews.count / limit)
        }
      }
    });
  } catch (error) {
    console.error('Get creator reviews error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get reviews'
    });
  }
};

// Get creator rate cards
exports.getCreatorRateCards = async (req, res) => {
  try {
    const { id } = req.params;

    const rateCards = await RateCard.findAll({
      where: { creatorId: id, isActive: true },
      order: [['platform', 'ASC'], ['contentType', 'ASC']]
    });

    const packages = await ServicePackage.findAll({
      where: { creatorId: id, isActive: true },
      order: [['price', 'ASC']]
    });

    res.json({
      success: true,
      data: { rateCards, packages }
    });
  } catch (error) {
    console.error('Get creator rate cards error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get rate cards'
    });
  }
};

// Get onboarding status
exports.getOnboardingStatus = async (req, res) => {
  try {
    const creator = req.creator;

    res.json({
      success: true,
      data: {
        currentStep: creator.onboardingStep,
        completed: creator.onboardingCompleted,
        completedAt: creator.onboardingCompletedAt
      }
    });
  } catch (error) {
    console.error('Get onboarding status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get onboarding status'
    });
  }
};

// Save onboarding step
exports.saveOnboardingStep = async (req, res) => {
  try {
    const creator = req.creator;
    const { step } = req.params;
    const data = req.body;

    const stepNum = parseInt(step);

    switch (stepNum) {
      case 1: // Basic Info
        await creator.update({
          firstName: data.firstName,
          lastName: data.lastName,
          displayName: data.displayName,
          bio: data.bio,
          profileImage: data.profileImage || data.avatarUrl,
          stateId: data.stateId,
          cityId: data.cityId,
          onboardingStep: Math.max(creator.onboardingStep, 2)
        });
        break;

      case 2: // Social Accounts
        // Handle social accounts
        if (data.socialAccounts && data.socialAccounts.length > 0) {
          for (const account of data.socialAccounts) {
            await SocialAccount.upsert({
              creatorId: creator.id,
              platform: account.platform,
              username: account.username,
              profileUrl: account.profileUrl,
              followerCount: account.followerCount,
              isVerified: account.isVerified || false
            });
          }
        }
        await creator.update({ onboardingStep: Math.max(creator.onboardingStep, 3) });
        break;

      case 3: // Categories
        // Handle category associations using primaryNicheId and secondaryNiches
        if (data.categoryIds && data.categoryIds.length > 0) {
          const [primaryNicheId, ...secondaryNiches] = data.categoryIds;
          await creator.update({
            primaryNicheId,
            secondaryNiches,
            onboardingStep: Math.max(creator.onboardingStep, 4)
          });
        } else {
          await creator.update({ onboardingStep: Math.max(creator.onboardingStep, 4) });
        }
        break;

      case 4: // Rate Cards
        // Handle rate cards - map frontend fields to model fields
        if (data.rateCards && data.rateCards.length > 0) {
          for (const card of data.rateCards) {
            await RateCard.create({
              creatorId: creator.id,
              platform: card.platform,
              contentType: card.contentType,
              basePrice: card.priceMin || card.basePrice || 0,
              maxPrice: card.priceMax || card.maxPrice || null,
              priceType: card.priceMax ? 'range' : 'fixed',
              description: card.description || null,
              deliveryDays: card.deliveryDays || 7
            });
          }
          // Update minimum budget on creator profile
          const minPrice = Math.min(...data.rateCards.map(c => parseFloat(c.priceMin || c.basePrice || 0)));
          await creator.update({
            minimumBudget: minPrice,
            onboardingStep: Math.max(creator.onboardingStep, 5)
          });
        } else {
          await creator.update({ onboardingStep: Math.max(creator.onboardingStep, 5) });
        }
        break;

      case 5: // Bank Details
        // Bank details handled separately via bank account routes
        await creator.update({ onboardingStep: 5 });
        break;

      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid onboarding step'
        });
    }

    res.json({
      success: true,
      message: 'Step saved successfully',
      data: { currentStep: creator.onboardingStep }
    });
  } catch (error) {
    console.error('Save onboarding step error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to save step'
    });
  }
};

// Complete onboarding
exports.completeOnboarding = async (req, res) => {
  try {
    const creator = req.creator;

    // Verify all required steps completed
    if (creator.onboardingStep < 5) {
      return res.status(400).json({
        success: false,
        message: 'Please complete all onboarding steps'
      });
    }

    // Update creator profile
    await creator.update({
      onboardingCompleted: true,
      onboardingCompletedAt: new Date()
    });

    // Also update the User model's onboardingCompleted flag and status
    // This is required for the creator to appear in search results
    await User.update(
      { onboardingCompleted: true, status: 'active' },
      { where: { id: creator.userId } }
    );

    res.json({
      success: true,
      message: 'Onboarding completed successfully'
    });
  } catch (error) {
    console.error('Complete onboarding error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete onboarding'
    });
  }
};

// Get my profile
exports.getMyProfile = async (req, res) => {
  try {
    const creator = await Creator.findByPk(req.creator.id, {
      include: [
        { model: User, as: 'user', attributes: ['email', 'createdAt'] },
        { model: State, as: 'state', include: [{ model: Region, as: 'region' }] },
        { model: City, as: 'city' },
        { model: Category, as: 'categories' }
      ]
    });

    res.json({
      success: true,
      data: creator
    });
  } catch (error) {
    console.error('Get my profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get profile'
    });
  }
};

// Update profile
exports.updateProfile = async (req, res) => {
  try {
    const creator = req.creator;
    const allowedFields = [
      'firstName', 'lastName', 'displayName', 'bio', 'phone',
      'stateId', 'cityId', 'regionId',
      'availabilityStatus', 'responseTime', 'leadTimeDays',
      'acceptsNegotiation', 'minimumBudget'
    ];

    const updates = {};
    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    }

    // Handle image fields with backwards compatibility
    if (req.body.profileImage || req.body.avatarUrl) {
      updates.profileImage = req.body.profileImage || req.body.avatarUrl;
    }
    if (req.body.coverImage || req.body.coverImageUrl) {
      updates.coverImage = req.body.coverImage || req.body.coverImageUrl;
    }

    await creator.update(updates);

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: creator
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile'
    });
  }
};

// Update avatar
exports.updateAvatar = async (req, res) => {
  try {
    const { avatarUrl, profileImage } = req.body;
    await req.creator.update({ profileImage: profileImage || avatarUrl });

    res.json({
      success: true,
      message: 'Avatar updated successfully'
    });
  } catch (error) {
    console.error('Update avatar error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update avatar'
    });
  }
};

// Update cover image
exports.updateCoverImage = async (req, res) => {
  try {
    const { coverImageUrl, coverImage } = req.body;
    await req.creator.update({ coverImage: coverImage || coverImageUrl });

    res.json({
      success: true,
      message: 'Cover image updated successfully'
    });
  } catch (error) {
    console.error('Update cover image error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update cover image'
    });
  }
};

// Stub implementations for remaining methods
exports.getMyCategories = async (req, res) => {
  try {
    const categories = await req.creator.getCategories();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get categories' });
  }
};

exports.updateCategories = async (req, res) => {
  try {
    const { categoryIds } = req.body;
    await req.creator.setCategories(categoryIds);
    res.json({ success: true, message: 'Categories updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update categories' });
  }
};

exports.getSocialAccounts = async (req, res) => {
  try {
    const accounts = await SocialAccount.findAll({ where: { creatorId: req.creator.id } });
    res.json({ success: true, data: accounts });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get social accounts' });
  }
};

exports.addSocialAccount = async (req, res) => {
  try {
    const account = await SocialAccount.create({ creatorId: req.creator.id, ...req.body });
    res.status(201).json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add social account' });
  }
};

exports.updateSocialAccount = async (req, res) => {
  try {
    const account = await SocialAccount.findOne({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!account) return res.status(404).json({ success: false, message: 'Not found' });
    await account.update(req.body);
    res.json({ success: true, data: account });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

exports.deleteSocialAccount = async (req, res) => {
  try {
    await SocialAccount.destroy({ where: { id: req.params.id, creatorId: req.creator.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

exports.getMyPortfolio = async (req, res) => {
  try {
    const items = await PortfolioItem.findAll({ where: { creatorId: req.creator.id }, order: [['displayOrder', 'ASC']] });
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get portfolio' });
  }
};

exports.addPortfolioItem = async (req, res) => {
  try {
    const item = await PortfolioItem.create({ creatorId: req.creator.id, ...req.body });
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add item' });
  }
};

exports.updatePortfolioItem = async (req, res) => {
  try {
    const item = await PortfolioItem.findOne({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    await item.update(req.body);
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

exports.deletePortfolioItem = async (req, res) => {
  try {
    await PortfolioItem.destroy({ where: { id: req.params.id, creatorId: req.creator.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

exports.reorderPortfolio = async (req, res) => {
  try {
    const { items } = req.body; // [{ id, displayOrder }]
    for (const item of items) {
      await PortfolioItem.update({ displayOrder: item.displayOrder }, { where: { id: item.id, creatorId: req.creator.id } });
    }
    res.json({ success: true, message: 'Reordered' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to reorder' });
  }
};

exports.getMyRateCards = async (req, res) => {
  try {
    const cards = await RateCard.findAll({ where: { creatorId: req.creator.id } });
    res.json({ success: true, data: cards });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get rate cards' });
  }
};

exports.addRateCard = async (req, res) => {
  try {
    const card = await RateCard.create({ creatorId: req.creator.id, ...req.body });
    res.status(201).json({ success: true, data: card });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add rate card' });
  }
};

exports.updateRateCard = async (req, res) => {
  try {
    const card = await RateCard.findOne({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!card) return res.status(404).json({ success: false, message: 'Not found' });
    await card.update(req.body);
    res.json({ success: true, data: card });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

exports.deleteRateCard = async (req, res) => {
  try {
    await RateCard.destroy({ where: { id: req.params.id, creatorId: req.creator.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

exports.getMyPackages = async (req, res) => {
  try {
    const packages = await ServicePackage.findAll({ where: { creatorId: req.creator.id } });
    res.json({ success: true, data: packages });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get packages' });
  }
};

exports.addPackage = async (req, res) => {
  try {
    const pkg = await ServicePackage.create({ creatorId: req.creator.id, ...req.body });
    res.status(201).json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add package' });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const pkg = await ServicePackage.findOne({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!pkg) return res.status(404).json({ success: false, message: 'Not found' });
    await pkg.update(req.body);
    res.json({ success: true, data: pkg });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    await ServicePackage.destroy({ where: { id: req.params.id, creatorId: req.creator.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

exports.getMyAvailability = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const today = new Date().toISOString().split('T')[0];

    // Get all slots from today onwards
    const slots = await AvailabilitySlot.findAll({
      where: {
        creatorId: req.creator.id,
        endDate: { [Op.gte]: today }
      },
      order: [['startDate', 'ASC']]
    });

    res.json({
      success: true,
      data: {
        isAvailable: req.creator.isAvailable,
        leadTimeDays: req.creator.leadTimeDays || 3,
        slots
      }
    });
  } catch (error) {
    console.error('Get my availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to get availability' });
  }
};

exports.updateAvailability = async (req, res) => {
  try {
    const { isAvailable, responseTime, leadTimeDays } = req.body;
    await req.creator.update({ isAvailable, responseTime, leadTimeDays });
    res.json({ success: true, message: 'Updated' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

exports.addAvailabilitySlot = async (req, res) => {
  try {
    const { startDate, endDate, isAvailable, reason, slotType } = req.body;

    // Validate dates
    if (new Date(startDate) > new Date(endDate)) {
      return res.status(400).json({ success: false, message: 'Start date must be before end date' });
    }

    const slot = await AvailabilitySlot.create({
      creatorId: req.creator.id,
      startDate,
      endDate,
      isAvailable: isAvailable !== undefined ? isAvailable : false,
      reason,
      slotType: slotType || 'blocked'
    });

    res.status(201).json({ success: true, data: slot });
  } catch (error) {
    console.error('Add availability slot error:', error);
    res.status(500).json({ success: false, message: 'Failed to add slot' });
  }
};

exports.deleteAvailabilitySlot = async (req, res) => {
  try {
    const deleted = await AvailabilitySlot.destroy({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!deleted) {
      return res.status(404).json({ success: false, message: 'Slot not found' });
    }
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

// Public endpoint - Get creator availability for brands to view
exports.getCreatorAvailability = async (req, res) => {
  try {
    const { Op } = require('sequelize');
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const creator = await Creator.findByPk(id, {
      attributes: ['id', 'displayName', 'isAvailable', 'leadTimeDays']
    });

    if (!creator) {
      return res.status(404).json({ success: false, message: 'Creator not found' });
    }

    const today = new Date().toISOString().split('T')[0];
    const threeMonthsLater = new Date();
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    // Get blocked/booked slots
    const blockedSlots = await AvailabilitySlot.findAll({
      where: {
        creatorId: id,
        endDate: { [Op.gte]: today },
        startDate: { [Op.lte]: threeMonthsLater.toISOString().split('T')[0] }
      },
      attributes: ['id', 'startDate', 'endDate', 'slotType', 'isAvailable'],
      order: [['startDate', 'ASC']]
    });

    // Check if requested date range is available
    let isRequestedRangeAvailable = true;
    let conflictingSlots = [];

    if (startDate && endDate) {
      const requestStart = new Date(startDate);
      const requestEnd = new Date(endDate);

      // Check lead time (minimum days before campaign can start)
      const leadTimeDays = creator.leadTimeDays || 3;
      const minStartDate = new Date();
      minStartDate.setDate(minStartDate.getDate() + leadTimeDays);

      if (requestStart < minStartDate) {
        isRequestedRangeAvailable = false;
        conflictingSlots.push({
          reason: `Creator requires ${leadTimeDays} days lead time`
        });
      }

      // Check for conflicts with blocked slots
      for (const slot of blockedSlots) {
        const slotStart = new Date(slot.startDate);
        const slotEnd = new Date(slot.endDate);

        // Check if there's overlap
        if (requestStart <= slotEnd && requestEnd >= slotStart && !slot.isAvailable) {
          isRequestedRangeAvailable = false;
          conflictingSlots.push({
            startDate: slot.startDate,
            endDate: slot.endDate,
            type: slot.slotType
          });
        }
      }
    }

    res.json({
      success: true,
      data: {
        creatorId: creator.id,
        displayName: creator.displayName,
        isGenerallyAvailable: creator.isAvailable,
        leadTimeDays: creator.leadTimeDays || 3,
        blockedSlots: blockedSlots.filter(s => !s.isAvailable),
        isRequestedRangeAvailable,
        conflictingSlots
      }
    });
  } catch (error) {
    console.error('Get creator availability error:', error);
    res.status(500).json({ success: false, message: 'Failed to get availability' });
  }
};

exports.getMyLegalClauses = async (req, res) => {
  try {
    const clauses = await LegalClause.findAll({ where: { creatorId: req.creator.id } });
    res.json({ success: true, data: clauses });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get clauses' });
  }
};

exports.addLegalClause = async (req, res) => {
  try {
    const clause = await LegalClause.create({ creatorId: req.creator.id, ...req.body });
    res.status(201).json({ success: true, data: clause });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to add clause' });
  }
};

exports.updateLegalClause = async (req, res) => {
  try {
    const clause = await LegalClause.findOne({ where: { id: req.params.id, creatorId: req.creator.id } });
    if (!clause) return res.status(404).json({ success: false, message: 'Not found' });
    await clause.update(req.body);
    res.json({ success: true, data: clause });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to update' });
  }
};

exports.deleteLegalClause = async (req, res) => {
  try {
    await LegalClause.destroy({ where: { id: req.params.id, creatorId: req.creator.id } });
    res.json({ success: true, message: 'Deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete' });
  }
};

// Get dashboard with stats and recent requests
exports.getDashboard = async (req, res) => {
  try {
    const creator = req.creator;

    // Get stats
    const stats = {
      totalEarnings: parseFloat(creator.totalEarnings) || 0,
      pendingEarnings: parseFloat(creator.pendingEarnings) || 0,
      availableBalance: parseFloat(creator.availableBalance) || 0,
      profileViews: creator.profileViews || 0,
      completedJobs: creator.completedCollaborations || 0,
      averageRating: parseFloat(creator.averageRating) || 0,
      totalReviews: creator.totalReviews || 0,
      tier: creator.tier,
      tierProgress: 0, // TODO: Calculate based on tier requirements
      pendingRequests: 0,
      unreadMessages: 0
    };

    // Count pending requests
    const pendingRequestCount = await CollaborationRequest.count({
      where: { creatorId: creator.id, status: 'pending' }
    });
    stats.pendingRequests = pendingRequestCount;

    // Get recent requests
    const recentRequests = await CollaborationRequest.findAll({
      where: { creatorId: creator.id },
      include: [
        {
          model: db.Brand,
          as: 'brand',
          attributes: ['id', 'companyName', 'logo']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: 5
    });

    res.json({
      success: true,
      data: {
        stats,
        recentRequests
      }
    });
  } catch (error) {
    console.error('Get dashboard error:', error);
    res.status(500).json({ success: false, message: 'Failed to get dashboard' });
  }
};

exports.getDashboardStats = async (req, res) => {
  try {
    const creator = req.creator;
    const stats = {
      totalEarnings: creator.totalEarnings,
      availableBalance: creator.availableBalance,
      pendingBalance: creator.pendingBalance,
      profileViews: creator.profileViews,
      totalDeals: creator.completedDeals,
      averageRating: creator.averageRating,
      totalReviews: creator.totalReviews,
      tier: creator.tier
    };
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get stats' });
  }
};

exports.getEarningsStats = async (req, res) => {
  try {
    // TODO: Implement detailed earnings breakdown
    res.json({ success: true, data: {} });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to get earnings' });
  }
};
