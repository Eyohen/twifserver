'use strict';

module.exports = (sequelize, DataTypes) => {
  const Creator = sequelize.define('Creator', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    // Onboarding tracking
    onboardingCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    onboardingStep: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    onboardingCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Basic Info (collected during onboarding)
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    displayName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    profileImage: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    coverImage: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    // Location
    regionId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Regions',
        key: 'id'
      }
    },
    stateId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'States',
        key: 'id'
      }
    },
    cityId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Cities',
        key: 'id'
      }
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Professional Info
    primaryNicheId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Categories',
        key: 'id'
      }
    },
    secondaryNiches: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: []
    },
    yearsOfExperience: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    languages: {
      type: DataTypes.ARRAY(DataTypes.STRING(50)),
      defaultValue: ['English']
    },
    // Tier System
    tier: {
      type: DataTypes.ENUM('rising', 'verified', 'premium', 'elite'),
      defaultValue: 'rising'
    },
    tierPoints: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    commissionRate: {
      type: DataTypes.DECIMAL(5, 4),
      defaultValue: 0.20
    },
    // Verification
    verificationStatus: {
      type: DataTypes.ENUM('unverified', 'pending', 'verified', 'rejected'),
      defaultValue: 'unverified'
    },
    verificationDocuments: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    arconCompliant: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Availability
    availabilityStatus: {
      type: DataTypes.ENUM('available', 'busy', 'not_accepting'),
      defaultValue: 'available'
    },
    responseTime: {
      type: DataTypes.ENUM('within_24h', 'within_48h', 'within_week'),
      defaultValue: 'within_48h'
    },
    leadTimeDays: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    },
    // Stats (denormalized for performance)
    totalEarnings: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    pendingEarnings: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    availableBalance: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    completedCollaborations: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    averageRating: {
      type: DataTypes.DECIMAL(3, 2),
      defaultValue: 0
    },
    totalReviews: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    profileViews: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Settings
    acceptsNegotiation: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    minimumBudget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    // Content preferences
    contentPreferences: {
      type: DataTypes.JSONB,
      defaultValue: {
        worksWithLargeBrands: true,
        worksWithSmallBusiness: true,
        worksWithStartups: true,
        worksWithIndividuals: true,
        worksWithAgencies: true,
        worksWithNonprofits: true
      }
    },
    restrictedCategories: {
      type: DataTypes.ARRAY(DataTypes.STRING(100)),
      defaultValue: []
    },
    // Suspension tracking
    declineCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    suspendedUntil: {
      type: DataTypes.DATE,
      allowNull: true
    },
    suspensionReason: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    totalSuspensions: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'Creators',
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['tier'] },
      { fields: ['verificationStatus'] },
      { fields: ['availabilityStatus'] },
      { fields: ['primaryNicheId'] },
      { fields: ['stateId'] },
      { fields: ['averageRating'] }
    ]
  });

  Creator.associate = function(models) {
    Creator.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    Creator.belongsTo(models.Region, {
      foreignKey: 'regionId',
      as: 'region'
    });
    Creator.belongsTo(models.State, {
      foreignKey: 'stateId',
      as: 'state'
    });
    Creator.belongsTo(models.City, {
      foreignKey: 'cityId',
      as: 'city'
    });
    Creator.belongsTo(models.Category, {
      foreignKey: 'primaryNicheId',
      as: 'primaryNiche'
    });
    Creator.hasMany(models.SocialAccount, {
      foreignKey: 'creatorId',
      as: 'socialAccounts'
    });
    Creator.hasMany(models.PortfolioItem, {
      foreignKey: 'creatorId',
      as: 'portfolio'
    });
    Creator.hasMany(models.RateCard, {
      foreignKey: 'creatorId',
      as: 'rateCards'
    });
    Creator.hasMany(models.ServicePackage, {
      foreignKey: 'creatorId',
      as: 'packages'
    });
    Creator.hasMany(models.AvailabilitySlot, {
      foreignKey: 'creatorId',
      as: 'availabilitySlots'
    });
    Creator.hasMany(models.LegalClause, {
      foreignKey: 'creatorId',
      as: 'legalClauses'
    });
    Creator.hasMany(models.CollaborationRequest, {
      foreignKey: 'creatorId',
      as: 'requests'
    });
    Creator.hasMany(models.Contract, {
      foreignKey: 'creatorId',
      as: 'contracts'
    });
    Creator.hasMany(models.Payment, {
      foreignKey: 'creatorId',
      as: 'payments'
    });
    Creator.hasMany(models.Payout, {
      foreignKey: 'creatorId',
      as: 'payouts'
    });
    Creator.hasMany(models.Conversation, {
      foreignKey: 'creatorId',
      as: 'conversations'
    });
    Creator.hasMany(models.SavedCreator, {
      foreignKey: 'creatorId',
      as: 'savedBy'
    });
  };

  return Creator;
};
