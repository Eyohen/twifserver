'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ShopifyStores', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      shopDomain: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      accessTokenEncrypted: { type: Sequelize.TEXT, allowNull: false },
      scopes: { type: Sequelize.STRING(255), allowNull: false, defaultValue: '' },
      installedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('ShopifyOrders', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      customerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Customers', key: 'id' },
        onDelete: 'CASCADE',
      },
      shopifyOrderId: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      orderNumber: { type: Sequelize.STRING(40), allowNull: true },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(10), allowNull: true },
      financialStatus: { type: Sequelize.STRING(40), allowNull: true },
      fulfillmentStatus: { type: Sequelize.STRING(40), allowNull: true },
      placedAt: { type: Sequelize.DATE, allowNull: true },
      shopifyAdminUrl: { type: Sequelize.STRING(500), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ShopifyOrders', ['customerId']);

    await queryInterface.createTable('ShopifySyncEvents', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      type: { type: Sequelize.STRING(20), allowNull: false },
      shopifyId: { type: Sequelize.STRING(40), allowNull: true },
      dedupeKey: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      result: { type: Sequelize.STRING(20), allowNull: false },
      errorMessage: { type: Sequelize.STRING(500), allowNull: true },
      payloadSummary: { type: Sequelize.STRING(500), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ShopifySyncEvents', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ShopifySyncEvents');
    await queryInterface.dropTable('ShopifyOrders');
    await queryInterface.dropTable('ShopifyStores');
  },
};
