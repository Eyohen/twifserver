'use strict';

module.exports = (sequelize, DataTypes) => {
  const PlatformSettings = sequelize.define('PlatformSettings', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    key: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    value: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    dataType: {
      type: DataTypes.ENUM('string', 'number', 'boolean', 'json'),
      defaultValue: 'string'
    },
    category: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    isPublic: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Admins',
        key: 'id'
      }
    }
  }, {
    tableName: 'PlatformSettings',
    timestamps: true,
    indexes: [
      { fields: ['key'], unique: true },
      { fields: ['category'] }
    ]
  });

  // Helper to get typed value
  PlatformSettings.prototype.getTypedValue = function() {
    switch (this.dataType) {
      case 'number':
        return parseFloat(this.value);
      case 'boolean':
        return this.value === 'true';
      case 'json':
        return JSON.parse(this.value);
      default:
        return this.value;
    }
  };

  // Default settings keys
  PlatformSettings.KEYS = {
    // General
    PLATFORM_NAME: 'platform_name',
    PLATFORM_URL: 'platform_url',
    SUPPORT_EMAIL: 'support_email',
    MAINTENANCE_MODE: 'maintenance_mode',

    // Commission
    DEFAULT_CREATOR_COMMISSION: 'default_creator_commission',
    DEFAULT_BRAND_PLATFORM_FEE: 'default_brand_platform_fee',

    // Payments
    MIN_WITHDRAWAL_AMOUNT: 'min_withdrawal_amount',
    MAX_WITHDRAWAL_AMOUNT: 'max_withdrawal_amount',
    ESCROW_RELEASE_DAYS: 'escrow_release_days',

    // Requests
    REQUEST_EXPIRY_HOURS: 'request_expiry_hours',
    MAX_NEGOTIATION_ROUNDS: 'max_negotiation_rounds',
    CREATOR_RESPONSE_TIME_HOURS: 'creator_response_time_hours',

    // Content
    MAX_PORTFOLIO_ITEMS_FREE: 'max_portfolio_items_free',
    MAX_RATE_CARDS: 'max_rate_cards',
    MAX_FILE_UPLOAD_SIZE_MB: 'max_file_upload_size_mb',

    // Verification
    REQUIRE_EMAIL_VERIFICATION: 'require_email_verification',
    REQUIRE_PHONE_VERIFICATION: 'require_phone_verification',

    // ARCON
    ARCON_COMPLIANCE_ENABLED: 'arcon_compliance_enabled',
    ARCON_DISCLAIMER_TEXT: 'arcon_disclaimer_text'
  };

  return PlatformSettings;
};
