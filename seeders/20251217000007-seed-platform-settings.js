'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const settings = [
      // General Settings
      { key: 'platform_name', value: 'CreatorsWorld', category: 'general', valueType: 'string', description: 'Platform display name' },
      { key: 'platform_tagline', value: 'Twifg Brands with Nigerian Creators', category: 'general', valueType: 'string', description: 'Platform tagline' },
      { key: 'support_email', value: 'support@creatorsworld.ng', category: 'general', valueType: 'string', description: 'Support email address' },
      { key: 'contact_phone', value: '+234 800 000 0000', category: 'general', valueType: 'string', description: 'Contact phone number' },

      // Payment Settings
      { key: 'min_withdrawal_amount', value: '5000', category: 'payment', valueType: 'number', description: 'Minimum withdrawal amount in Naira' },
      { key: 'max_withdrawal_amount', value: '10000000', category: 'payment', valueType: 'number', description: 'Maximum withdrawal amount in Naira' },
      { key: 'withdrawal_processing_days', value: '3', category: 'payment', valueType: 'number', description: 'Days to process withdrawals' },
      { key: 'escrow_hold_days', value: '7', category: 'payment', valueType: 'number', description: 'Days to hold escrow after completion' },
      { key: 'paystack_enabled', value: 'true', category: 'payment', valueType: 'boolean', description: 'Enable Paystack payments' },

      // Request Settings
      { key: 'max_negotiation_rounds', value: '3', category: 'request', valueType: 'number', description: 'Maximum negotiation rounds allowed' },
      { key: 'request_expiry_days', value: '7', category: 'request', valueType: 'number', description: 'Days before pending request expires' },
      { key: 'max_revision_requests', value: '2', category: 'request', valueType: 'number', description: 'Maximum content revision requests' },

      // Creator Settings
      { key: 'min_rate_amount', value: '5000', category: 'creator', valueType: 'number', description: 'Minimum rate amount in Naira' },
      { key: 'max_portfolio_items_rising', value: '5', category: 'creator', valueType: 'number', description: 'Max portfolio items for Rising tier' },
      { key: 'max_portfolio_items_verified', value: '15', category: 'creator', valueType: 'number', description: 'Max portfolio items for Verified tier' },
      { key: 'max_portfolio_items_premium', value: '30', category: 'creator', valueType: 'number', description: 'Max portfolio items for Premium tier' },
      { key: 'max_categories_per_creator', value: '5', category: 'creator', valueType: 'number', description: 'Maximum categories a creator can select' },

      // Brand Settings
      { key: 'starter_message_limit', value: '10', category: 'brand', valueType: 'number', description: 'Monthly message limit for Starter tier' },
      { key: 'growth_message_limit', value: '50', category: 'brand', valueType: 'number', description: 'Monthly message limit for Growth tier' },
      { key: 'business_message_limit', value: '200', category: 'brand', valueType: 'number', description: 'Monthly message limit for Business tier' },

      // Review Settings
      { key: 'review_enabled_after_days', value: '3', category: 'review', valueType: 'number', description: 'Days after completion before review is enabled' },
      { key: 'review_window_days', value: '30', category: 'review', valueType: 'number', description: 'Days available to leave a review' },

      // Notification Settings
      { key: 'email_notifications_enabled', value: 'true', category: 'notification', valueType: 'boolean', description: 'Enable email notifications' },
      { key: 'sms_notifications_enabled', value: 'false', category: 'notification', valueType: 'boolean', description: 'Enable SMS notifications' },

      // Compliance Settings
      { key: 'arcon_compliance_required', value: 'true', category: 'compliance', valueType: 'boolean', description: 'Require ARCON compliance for campaigns' },
      { key: 'kyc_required_for_withdrawal', value: 'true', category: 'compliance', valueType: 'boolean', description: 'Require KYC before withdrawals' }
    ];

    const settingsData = settings.map(s => ({
      id: uuidv4(),
      key: s.key,
      value: s.value,
      category: s.category,
      valueType: s.valueType,
      description: s.description,
      isEditable: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await queryInterface.bulkInsert('PlatformSettings', settingsData, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('PlatformSettings', null, {});
  }
};
