'use strict';

module.exports = (sequelize, DataTypes) => {
  const TierConfiguration = sequelize.define('TierConfiguration', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userType: {
      type: DataTypes.ENUM('creator', 'brand'),
      allowNull: false
    },
    tierName: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    tierLevel: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // Requirements (for progression)
    minDaysActive: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    minCompletedDeals: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    minEarnings: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    minRating: {
      type: DataTypes.DECIMAL(3, 2),
      allowNull: true
    },
    minResponseRate: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Benefits - Creator
    commissionRate: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true
    },
    searchBoostPercentage: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    portfolioItemLimit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    withdrawalDays: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    verifiedBadge: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    featuredPlacement: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Benefits - Brand
    monthlyPrice: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    yearlyPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    monthlyMessageLimit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    activeCampaignLimit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    searchResultsLimit: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    platformFeePercentage: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: true
    },
    prioritySupport: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    supportResponseHours: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    aiMatching: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Additional benefits as JSON
    additionalBenefits: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    // Display
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    badgeIcon: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    badgeColor: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'TierConfigurations',
    timestamps: true,
    indexes: [
      { fields: ['userType', 'tierName'], unique: true },
      { fields: ['userType', 'tierLevel'] }
    ]
  });

  return TierConfiguration;
};
