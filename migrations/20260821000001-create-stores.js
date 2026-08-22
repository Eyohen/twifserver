'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('Stores', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      key: {
        type: Sequelize.STRING(40),
        allowNull: false,
        unique: true,
      },
      name: {
        type: Sequelize.STRING(120),
        allowNull: false,
      },
      location: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      manager: {
        type: Sequelize.STRING(120),
        allowNull: true,
      },
      addressLines: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: [],
      },
      phone: {
        type: Sequelize.STRING(40),
        allowNull: true,
      },
      email: {
        type: Sequelize.STRING(160),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('active', 'inactive'),
        allowNull: false,
        defaultValue: 'active',
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('Stores');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Stores_status";');
  },
};
