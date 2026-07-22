'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable('StaffUsers');
    if (!table.profileImageUrl) {
      await queryInterface.addColumn('StaffUsers', 'profileImageUrl', {
        type: Sequelize.STRING(500),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable('StaffUsers');
    if (table.profileImageUrl) await queryInterface.removeColumn('StaffUsers', 'profileImageUrl');
  },
};
