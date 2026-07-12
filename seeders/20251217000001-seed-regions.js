'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const regions = [
      { id: uuidv4(), name: 'North Central', code: 'NC', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'North East', code: 'NE', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'North West', code: 'NW', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'South East', code: 'SE', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'South South', code: 'SS', isActive: true, createdAt: new Date(), updatedAt: new Date() },
      { id: uuidv4(), name: 'South West', code: 'SW', isActive: true, createdAt: new Date(), updatedAt: new Date() }
    ];

    await queryInterface.bulkInsert('Regions', regions, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Regions', null, {});
  }
};
