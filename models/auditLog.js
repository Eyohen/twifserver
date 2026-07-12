'use strict';

module.exports = (sequelize, DataTypes) => {
  const AuditLog = sequelize.define('AuditLog', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    adminId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Admins',
        key: 'id'
      }
    },
    action: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    entity: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    entityId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    previousData: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    newData: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    ipAddress: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    userAgent: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'AuditLogs',
    timestamps: true,
    updatedAt: false,
    indexes: [
      { fields: ['adminId'] },
      { fields: ['entity'] },
      { fields: ['entityId'] },
      { fields: ['action'] },
      { fields: ['createdAt'] }
    ]
  });

  AuditLog.associate = function(models) {
    AuditLog.belongsTo(models.Admin, {
      foreignKey: 'adminId',
      as: 'admin'
    });
  };

  // Audit action types
  AuditLog.ACTIONS = {
    // User actions
    USER_CREATED: 'user_created',
    USER_UPDATED: 'user_updated',
    USER_SUSPENDED: 'user_suspended',
    USER_ACTIVATED: 'user_activated',
    USER_DELETED: 'user_deleted',

    // Creator actions
    CREATOR_VERIFIED: 'creator_verified',
    CREATOR_REJECTED: 'creator_rejected',
    CREATOR_TIER_CHANGED: 'creator_tier_changed',

    // Brand actions
    BRAND_VERIFIED: 'brand_verified',
    BRAND_TIER_CHANGED: 'brand_tier_changed',

    // Request actions
    REQUEST_CANCELLED: 'request_cancelled',
    DISPUTE_RESOLVED: 'dispute_resolved',

    // Payment actions
    ESCROW_RELEASED: 'escrow_released',
    REFUND_PROCESSED: 'refund_processed',
    PAYOUT_PROCESSED: 'payout_processed',

    // Settings actions
    SETTINGS_UPDATED: 'settings_updated',
    TIER_CONFIG_UPDATED: 'tier_config_updated',
    CATEGORY_CREATED: 'category_created',
    CATEGORY_UPDATED: 'category_updated',
    CATEGORY_DELETED: 'category_deleted',

    // Template actions
    TEMPLATE_CREATED: 'template_created',
    TEMPLATE_UPDATED: 'template_updated',

    // Admin actions
    ADMIN_LOGIN: 'admin_login',
    ADMIN_LOGOUT: 'admin_logout',
    ADMIN_CREATED: 'admin_created',
    ADMIN_UPDATED: 'admin_updated'
  };

  return AuditLog;
};
