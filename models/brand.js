'use strict';

module.exports = (sequelize, DataTypes) => {
  const Brand = sequelize.define('Brand', {
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
    // Business Info (filled during onboarding)
    companyName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    businessType: {
      type: DataTypes.ENUM('startup', 'sme', 'enterprise', 'agency', 'individual'),
      allowNull: true
    },
    industryId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Industries',
        key: 'id'
      }
    },
    website: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    logo: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Contact Person (filled during onboarding)
    contactFirstName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    contactLastName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    contactPosition: {
      type: DataTypes.STRING(100),
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
    // Tier System
    tier: {
      type: DataTypes.ENUM('starter', 'growth', 'business', 'enterprise'),
      defaultValue: 'starter'
    },
    tierExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    monthlyBudget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    // Verification
    cacRegistered: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    cacNumber: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    verificationStatus: {
      type: DataTypes.ENUM('unverified', 'pending', 'verified'),
      defaultValue: 'unverified'
    },
    verificationDocuments: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    // Stats
    totalSpent: {
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
    // Usage Limits (based on tier)
    messagesUsedThisMonth: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    activeCampaignsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    // Preferences
    preferredNiches: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: []
    },
    preferredPlatforms: {
      type: DataTypes.ARRAY(DataTypes.STRING(50)),
      defaultValue: []
    },
    // Onboarding
    onboardingStep: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    onboardingCompleted: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    onboardingCompletedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'Brands',
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['tier'] },
      { fields: ['industryId'] },
      { fields: ['stateId'] },
      { fields: ['verificationStatus'] }
    ]
  });

  Brand.associate = function(models) {
    Brand.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    Brand.belongsTo(models.Industry, {
      foreignKey: 'industryId',
      as: 'industry'
    });
    Brand.belongsTo(models.Region, {
      foreignKey: 'regionId',
      as: 'region'
    });
    Brand.belongsTo(models.State, {
      foreignKey: 'stateId',
      as: 'state'
    });
    Brand.belongsTo(models.City, {
      foreignKey: 'cityId',
      as: 'city'
    });
    Brand.hasMany(models.CollaborationRequest, {
      foreignKey: 'brandId',
      as: 'requests'
    });
    Brand.hasMany(models.Contract, {
      foreignKey: 'brandId',
      as: 'contracts'
    });
    Brand.hasMany(models.Payment, {
      foreignKey: 'brandId',
      as: 'payments'
    });
    Brand.hasMany(models.Conversation, {
      foreignKey: 'brandId',
      as: 'conversations'
    });
    Brand.hasMany(models.SavedCreator, {
      foreignKey: 'brandId',
      as: 'savedCreators'
    });
  };

  return Brand;
};
