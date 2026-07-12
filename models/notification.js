'use strict';

module.exports = (sequelize, DataTypes) => {
  const Notification = sequelize.define('Notification', {
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
    type: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    // Reference to related entity
    referenceType: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    referenceId: {
      type: DataTypes.UUID,
      allowNull: true
    },
    // Action URL
    actionUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    // Status
    isRead: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Delivery Status
    emailSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    emailSentAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    pushSent: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    pushSentAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    // Priority
    priority: {
      type: DataTypes.ENUM('low', 'normal', 'high'),
      defaultValue: 'normal'
    }
  }, {
    tableName: 'Notifications',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['type'] },
      { fields: ['isRead'] },
      { fields: ['createdAt'] }
    ]
  });

  Notification.associate = function(models) {
    Notification.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  // Notification types
  Notification.TYPES = {
    // Request notifications
    REQUEST_RECEIVED: 'request_received',
    REQUEST_VIEWED: 'request_viewed',
    REQUEST_ACCEPTED: 'request_accepted',
    REQUEST_DECLINED: 'request_declined',
    REQUEST_COUNTER_OFFER: 'request_counter_offer',
    REQUEST_EXPIRED: 'request_expired',

    // Content notifications
    CONTENT_SUBMITTED: 'content_submitted',
    CONTENT_APPROVED: 'content_approved',
    REVISION_REQUESTED: 'revision_requested',

    // Contract notifications
    CONTRACT_READY: 'contract_ready',
    CONTRACT_SIGNED: 'contract_signed',
    CONTRACT_COMPLETED: 'contract_completed',

    // Payment notifications
    PAYMENT_RECEIVED: 'payment_received',
    PAYMENT_RELEASED: 'payment_released',
    PAYOUT_PROCESSED: 'payout_processed',
    PAYOUT_FAILED: 'payout_failed',

    // Message notifications
    NEW_MESSAGE: 'new_message',

    // Review notifications
    REVIEW_RECEIVED: 'review_received',

    // Profile notifications
    PROFILE_VIEWED: 'profile_viewed',
    PROFILE_MILESTONE: 'profile_milestone',

    // Tier notifications
    TIER_UPGRADED: 'tier_upgraded',
    TIER_REQUIREMENTS_MET: 'tier_requirements_met',

    // System notifications
    VERIFICATION_APPROVED: 'verification_approved',
    VERIFICATION_REJECTED: 'verification_rejected',
    ACCOUNT_WARNING: 'account_warning',
    SYSTEM_ANNOUNCEMENT: 'system_announcement',

    // Twif notifications
    CONNECTION_REQUEST: 'connection_request',
    CONNECTION_ACCEPTED: 'connection_accepted',
    OPPORTUNITY_INTEREST: 'opportunity_interest',
    BOOKING_REQUEST: 'booking_request',
    BOOKING_ACCEPTED: 'booking_accepted',
    BOOKING_DECLINED: 'booking_declined',
    BOOKING_CANCELLED: 'booking_cancelled'
  };

  return Notification;
};
