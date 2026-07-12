'use strict';
const { v4: uuidv4 } = require('uuid');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Get states
    const states = await queryInterface.sequelize.query(
      'SELECT id, code FROM "States";',
      { type: Sequelize.QueryTypes.SELECT }
    );

    const stateMap = {};
    states.forEach(s => { stateMap[s.code] = s.id; });

    const cities = [
      // Lagos
      { name: 'Victoria Island', state: 'LA' },
      { name: 'Lekki', state: 'LA' },
      { name: 'Ikeja', state: 'LA' },
      { name: 'Ikoyi', state: 'LA' },
      { name: 'Surulere', state: 'LA' },
      { name: 'Yaba', state: 'LA' },
      { name: 'Ajah', state: 'LA' },
      { name: 'Maryland', state: 'LA' },
      { name: 'Gbagada', state: 'LA' },
      { name: 'Magodo', state: 'LA' },
      { name: 'Festac', state: 'LA' },
      { name: 'Apapa', state: 'LA' },
      { name: 'Ogba', state: 'LA' },
      { name: 'Oshodi', state: 'LA' },
      { name: 'Ikorodu', state: 'LA' },

      // FCT Abuja
      { name: 'Wuse', state: 'FC' },
      { name: 'Maitama', state: 'FC' },
      { name: 'Garki', state: 'FC' },
      { name: 'Asokoro', state: 'FC' },
      { name: 'Central Area', state: 'FC' },
      { name: 'Gwarinpa', state: 'FC' },
      { name: 'Jabi', state: 'FC' },
      { name: 'Utako', state: 'FC' },
      { name: 'Wuye', state: 'FC' },
      { name: 'Kubwa', state: 'FC' },

      // Rivers
      { name: 'Port Harcourt', state: 'RI' },
      { name: 'GRA Phase 1', state: 'RI' },
      { name: 'GRA Phase 2', state: 'RI' },
      { name: 'Rumuokoro', state: 'RI' },
      { name: 'Eleme', state: 'RI' },

      // Oyo
      { name: 'Ibadan', state: 'OY' },
      { name: 'Bodija', state: 'OY' },
      { name: 'Dugbe', state: 'OY' },
      { name: 'Ring Road', state: 'OY' },

      // Kano
      { name: 'Kano City', state: 'KN' },
      { name: 'Sabon Gari', state: 'KN' },
      { name: 'Nassarawa GRA', state: 'KN' },

      // Anambra
      { name: 'Onitsha', state: 'AN' },
      { name: 'Awka', state: 'AN' },
      { name: 'Nnewi', state: 'AN' },

      // Delta
      { name: 'Warri', state: 'DE' },
      { name: 'Asaba', state: 'DE' },
      { name: 'Effurun', state: 'DE' },

      // Edo
      { name: 'Benin City', state: 'ED' },
      { name: 'GRA Benin', state: 'ED' },
      { name: 'Ring Road Benin', state: 'ED' },

      // Kaduna
      { name: 'Kaduna City', state: 'KD' },
      { name: 'Kaduna North', state: 'KD' },
      { name: 'Kafanchan', state: 'KD' },

      // Ogun
      { name: 'Abeokuta', state: 'OG' },
      { name: 'Ota', state: 'OG' },
      { name: 'Ijebu Ode', state: 'OG' },
      { name: 'Sagamu', state: 'OG' },

      // Enugu
      { name: 'Enugu City', state: 'EN' },
      { name: 'Independence Layout', state: 'EN' },
      { name: 'New Haven', state: 'EN' },

      // Akwa Ibom
      { name: 'Uyo', state: 'AK' },
      { name: 'Eket', state: 'AK' },

      // Cross River
      { name: 'Calabar', state: 'CR' },
      { name: 'Calabar South', state: 'CR' }
    ];

    const cityData = cities.map(c => ({
      id: uuidv4(),
      stateId: stateMap[c.state],
      name: c.name,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date()
    }));

    await queryInterface.bulkInsert('Cities', cityData, {});
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.bulkDelete('Cities', null, {});
  }
};
