'use strict';

module.exports = (sequelize, DataTypes) => {
  const PortfolioItem = sequelize.define('PortfolioItem', {
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    mediaType: {
      type: DataTypes.ENUM('image', 'video', 'link'),
      allowNull: false
    },
    mediaUrl: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    thumbnailUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    platform: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    brandName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    campaignType: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    results: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {
    tableName: 'PortfolioItems',
    timestamps: true,
    indexes: [
      { fields: ['creatorId'] },
      { fields: ['displayOrder'] }
    ]
  });

  PortfolioItem.associate = function(models) {
    PortfolioItem.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
  };

  return PortfolioItem;
};
