'use strict';

module.exports = (sequelize, DataTypes) => {
  const PersonalProfile = sequelize.define('PersonalProfile', {
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
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    displayName: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    headline: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    bio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true
    },
    avatarUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    website: {
      type: DataTypes.STRING(500),
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
    cvFileName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    cvFileUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    cvUploadedAt: {
      type: DataTypes.DATE,
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
    tableName: 'PersonalProfiles',
    timestamps: true,
    indexes: [
      { fields: ['userId'], unique: true },
      { fields: ['firstName'] },
      { fields: ['lastName'] }
    ]
  });

  PersonalProfile.associate = function(models) {
    PersonalProfile.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return PersonalProfile;
};
