'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('StaffUsers', 'tailorDepartments', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: [],
    });
    await queryInterface.sequelize.query(`
      UPDATE "StaffUsers"
      SET "tailorDepartments" = jsonb_build_array("tailorDepartment")
      WHERE "role" = 'tailor' AND "tailorDepartment" IS NOT NULL
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('StaffUsers', 'tailorDepartments');
  },
};
