'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('InventoryAllocations', 'itemIndex', {
      type: Sequelize.INTEGER,
      allowNull: true,
    });
    await queryInterface.addColumn('InventoryAllocations', 'itemName', {
      type: Sequelize.STRING(160),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('InventoryAllocations', 'itemIndex');
    await queryInterface.removeColumn('InventoryAllocations', 'itemName');
  },
};
