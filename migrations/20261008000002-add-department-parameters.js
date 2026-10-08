'use strict';

const defaults = require('../config/departmentFields');

module.exports = {
  async up(queryInterface, Sequelize) {
    // Column creation may already have committed if a later data backfill is
    // interrupted (Postgres DDL is not wrapped by sequelize-cli here).
    const columns = await queryInterface.describeTable('Departments');
    if (!columns.fields) await queryInterface.addColumn('Departments', 'fields', { type: Sequelize.JSONB, allowNull: false, defaultValue: [] });
    if (!columns.note) await queryInterface.addColumn('Departments', 'note', { type: Sequelize.TEXT, allowNull: false, defaultValue: '' });
    await Promise.all(Object.entries(defaults).map(([key, config]) => queryInterface.bulkUpdate('Departments', {
      fields: JSON.stringify(config.fields),
      note: config.note,
    }, { key })));
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Departments', 'note');
    await queryInterface.removeColumn('Departments', 'fields');
  },
};
