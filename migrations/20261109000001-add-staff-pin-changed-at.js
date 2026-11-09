'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Nullable and unfilled on purpose: nothing recorded when existing PINs were
    // set, so the screen says "Not recorded" for them rather than inventing a date.
    await queryInterface.addColumn('StaffUsers', 'pinChangedAt', {
      type: Sequelize.DATE,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('StaffUsers', 'pinChangedAt');
  },
};
