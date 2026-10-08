'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "StaffUsers" ALTER COLUMN "tailorDepartment" TYPE VARCHAR(40) USING "tailorDepartment"::text;'
    );
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_StaffUsers_tailorDepartment";');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('StaffUsers', 'tailorDepartment', {
      type: Sequelize.ENUM('native', 'suit', 'trouser', 'finishing'), allowNull: true,
    });
  },
};
