'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('InventoryEditRequests', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true, allowNull: false },
      fabricId: { type: Sequelize.UUID, allowNull: false, references: { model: 'Fabrics', key: 'id' }, onDelete: 'CASCADE' },
      requestedBy: { type: Sequelize.STRING(160), allowNull: false },
      requestedByRole: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'inventory_manager' },
      proposedChanges: { type: Sequelize.JSONB, allowNull: false, defaultValue: {} },
      reason: { type: Sequelize.TEXT, allowNull: false },
      status: { type: Sequelize.STRING(30), allowNull: false, defaultValue: 'Pending Owner Approval' },
      reviewedBy: { type: Sequelize.STRING(160), allowNull: true }, reviewedAt: { type: Sequelize.DATE, allowNull: true }, reviewNote: { type: Sequelize.TEXT, allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false }, updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('InventoryEditRequests', ['status', 'createdAt']);
    await queryInterface.addIndex('InventoryEditRequests', ['fabricId']);
  },
  async down(queryInterface) { await queryInterface.dropTable('InventoryEditRequests'); },
};
