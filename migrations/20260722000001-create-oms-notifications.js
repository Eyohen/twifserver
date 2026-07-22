'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('OmsNotifications', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      recipientRole: { type: Sequelize.STRING(40), allowNull: false },
      channel: { type: Sequelize.STRING(60), allowNull: false, defaultValue: 'Inventory' },
      message: { type: Sequelize.TEXT, allowNull: false },
      metadata: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      isRead: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('OmsNotifications', ['recipientRole', 'createdAt']);

    await queryInterface.createTable('InventoryAllocations', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      fabricId: { type: Sequelize.UUID, allowNull: false },
      fabricName: { type: Sequelize.STRING(160), allowNull: false },
      quantity: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
      unit: { type: Sequelize.STRING(24), allowNull: false },
      invoiceNumber: { type: Sequelize.STRING(40), allowNull: false },
      customerName: { type: Sequelize.STRING(160), allowNull: false },
      tailorName: { type: Sequelize.STRING(120), allowNull: false },
      trackingToken: { type: Sequelize.STRING(128), allowNull: false, unique: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('InventoryAllocations', ['fabricId', 'createdAt']);
    await queryInterface.addIndex('InventoryAllocations', ['invoiceNumber']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('InventoryAllocations');
    await queryInterface.dropTable('OmsNotifications');
  },
};
