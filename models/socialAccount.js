'use strict';

module.exports = (sequelize, DataTypes) => {
  const SocialAccount = sequelize.define('SocialAccount', {
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
      type: DataTypes.ENUM('instagram', 'tiktok', 'youtube', 'twitter', 'facebook', 'linkedin', 'snapchat', 'threads'),
      allowNull: false
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    profileUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    followersCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    followingCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    postsCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    engagementRate: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    accessToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    refreshToken: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tokenExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastSyncedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    metrics: {
      type: DataTypes.JSONB,
      allowNull: true,
      defaultValue: {}
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'SocialAccounts',
    timestamps: true,
    indexes: [
      { fields: ['creatorId'] },
      { fields: ['platform'] },
      { fields: ['creatorId', 'platform'], unique: true }
    ]
  });

  SocialAccount.associate = function(models) {
    SocialAccount.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
  };

  return SocialAccount;
};
