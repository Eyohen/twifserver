'use strict';

module.exports = (sequelize, DataTypes) => {
  const RateCard = sequelize.define('RateCard', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Creators',
        key: 'id'
      }
    },
    platform: {
      type: DataTypes.ENUM('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'blog', 'podcast', 'other'),
      allowNull: false
    },
    contentType: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    priceType: {
      type: DataTypes.ENUM('fixed', 'range', 'starting_from', 'contact'),
      defaultValue: 'fixed'
    },
    basePrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    maxPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'NGN'
    },
    deliveryDays: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 7
    },
    revisionsIncluded: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    usageRightsDays: {
      type: DataTypes.INTEGER,
      defaultValue: 30
    },
    includes: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    addOns: {
      type: DataTypes.JSONB,
      defaultValue: {
        rushDelivery: { enabled: false, percentageIncrease: 25 },
        extendedUsage: { enabled: false, percentageIncrease: 50 },
        exclusivity: { enabled: false, percentageIncrease: 40 }
      }
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'RateCards',
    timestamps: true,
    indexes: [
      { fields: ['creatorId'] },
      { fields: ['platform'] },
      { fields: ['isActive'] }
    ]
  });

  RateCard.associate = function(models) {
    RateCard.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
  };

  // Content type options by platform
  RateCard.CONTENT_TYPES = {
    instagram: ['Post', 'Carousel', 'Reel (15-30s)', 'Reel (60s+)', 'Story', 'Story Pack (3-5)', 'Live', 'IGTV'],
    tiktok: ['Video (15-60s)', 'Video (60s+)', 'Live', 'Duet/Stitch'],
    youtube: ['Dedicated Video', 'Integration', 'Shorts', 'Live Stream', 'Community Post'],
    twitter: ['Tweet', 'Thread', 'Space'],
    facebook: ['Post', 'Reel', 'Story', 'Live'],
    linkedin: ['Post', 'Article', 'Video'],
    blog: ['Blog Post', 'Guest Article', 'Product Review'],
    podcast: ['Mention', 'Sponsored Segment', 'Full Episode'],
    other: ['Photography', 'Event Appearance', 'Brand Ambassador (Monthly)', 'UGC Creation']
  };

  return RateCard;
};
