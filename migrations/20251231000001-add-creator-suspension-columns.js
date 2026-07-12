'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // Add suspension-related columns to Creators table
    await queryInterface.addColumn('Creators', 'declineCount', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });

    await queryInterface.addColumn('Creators', 'suspendedUntil', {
      type: Sequelize.DATE,
      allowNull: true
    });

    await queryInterface.addColumn('Creators', 'suspensionReason', {
      type: Sequelize.STRING(255),
      allowNull: true
    });

    await queryInterface.addColumn('Creators', 'totalSuspensions', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
      allowNull: false
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Creators', 'declineCount');
    await queryInterface.removeColumn('Creators', 'suspendedUntil');
    await queryInterface.removeColumn('Creators', 'suspensionReason');
    await queryInterface.removeColumn('Creators', 'totalSuspensions');
  }
};
