'use strict';

module.exports = (sequelize, DataTypes) => {
  const ServicePackage = sequelize.define('ServicePackage', {
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
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    packageType: {
      type: DataTypes.ENUM('starter', 'standard', 'premium', 'custom'),
      defaultValue: 'standard'
    },
    price: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    originalPrice: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    discountPercentage: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'NGN'
    },
    deliveryDays: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    maxRevisions: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    includedServices: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    features: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    isFeatured: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'ServicePackages',
    timestamps: true,
    indexes: [
      { fields: ['creatorId'] },
      { fields: ['isActive'] },
      { fields: ['packageType'] }
    ]
  });

  ServicePackage.associate = function(models) {
    ServicePackage.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
  };

  return ServicePackage;
};
