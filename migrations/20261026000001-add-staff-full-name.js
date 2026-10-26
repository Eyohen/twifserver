'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('StaffUsers', 'fullName', {
      type: Sequelize.STRING(120),
      allowNull: true,
    });
    await queryInterface.sequelize.query(`
      UPDATE "StaffUsers"
      SET "fullName" = "displayName"
      WHERE "fullName" IS NULL OR BTRIM("fullName") = '';
    `);
    await queryInterface.changeColumn('StaffUsers', 'fullName', {
      type: Sequelize.STRING(120),
      allowNull: false,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('StaffUsers', 'fullName');
  },
};
