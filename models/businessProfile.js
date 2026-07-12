'use strict';

module.exports = (sequelize, DataTypes) => {
  const BusinessProfile = sequelize.define('BusinessProfile', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    businessName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    contactName: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    businessType: {
      type: DataTypes.ENUM('startup', 'sme', 'enterprise', 'agency', 'nonprofit', 'other'),
      allowNull: true
    },
    industry: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    website: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    logoUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    country: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true
    },
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
    tableName: 'BusinessProfiles',
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['businessName'] },
      { fields: ['industry'] }
    ]
  });

  BusinessProfile.associate = function(models) {
    BusinessProfile.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return BusinessProfile;
};
