'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get regions
    const regions = await queryInterface.sequelize.query(
      'SELECT id, code FROM "Regions";',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const regionMap = {};
    regions.forEach(r => { regionMap[r.code] = r.id; });

    const states = [
      // North Central
      { name: 'Benue', code: 'BN', region: 'NC' },
      { name: 'Federal Capital Territory', code: 'FC', region: 'NC' },
      { name: 'Kogi', code: 'KG', region: 'NC' },
      { name: 'Kwara', code: 'KW', region: 'NC' },
      { name: 'Nasarawa', code: 'NA', region: 'NC' },
      { name: 'Niger', code: 'NI', region: 'NC' },
      { name: 'Plateau', code: 'PL', region: 'NC' },

      // North East
      { name: 'Adamawa', code: 'AD', region: 'NE' },
      { name: 'Bauchi', code: 'BA', region: 'NE' },
      { name: 'Borno', code: 'BO', region: 'NE' },
      { name: 'Gombe', code: 'GO', region: 'NE' },
      { name: 'Taraba', code: 'TA', region: 'NE' },
      { name: 'Yobe', code: 'YO', region: 'NE' },

      // North West
      { name: 'Jigawa', code: 'JI', region: 'NW' },
      { name: 'Kaduna', code: 'KD', region: 'NW' },
      { name: 'Kano', code: 'KN', region: 'NW' },
      { name: 'Katsina', code: 'KT', region: 'NW' },
      { name: 'Kebbi', code: 'KB', region: 'NW' },
      { name: 'Sokoto', code: 'SO', region: 'NW' },
      { name: 'Zamfara', code: 'ZA', region: 'NW' },

      // South East
      { name: 'Abia', code: 'AB', region: 'SE' },
      { name: 'Anambra', code: 'AN', region: 'SE' },
      { name: 'Ebonyi', code: 'EB', region: 'SE' },
      { name: 'Enugu', code: 'EN', region: 'SE' },
      { name: 'Imo', code: 'IM', region: 'SE' },

      // South South
      { name: 'Akwa Ibom', code: 'AK', region: 'SS' },
      { name: 'Bayelsa', code: 'BY', region: 'SS' },
      { name: 'Cross River', code: 'CR', region: 'SS' },
      { name: 'Delta', code: 'DE', region: 'SS' },
      { name: 'Edo', code: 'ED', region: 'SS' },
      { name: 'Rivers', code: 'RI', region: 'SS' },

      // South West
      { name: 'Ekiti', code: 'EK', region: 'SW' },
      { name: 'Lagos', code: 'LA', region: 'SW' },
      { name: 'Ogun', code: 'OG', region: 'SW' },
      { name: 'Ondo', code: 'ON', region: 'SW' },
      { name: 'Osun', code: 'OS', region: 'SW' },
      { name: 'Oyo', code: 'OY', region: 'SW' }
    ];

    const stateData = states.map(s => ({
      id: uuidv4(),
      regionId: regionMap[s.region],
      name: s.name,
      code: s.code,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await queryInterface.bulkInsert('States', stateData, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('States', null, {});
  }
};
