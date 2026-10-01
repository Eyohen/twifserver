'use strict';

// The Customers.phone column accumulated many duplicate unique constraints
// from sequelize.sync({ alter: true }) re-running on every dev restart
// (constraint name conflicts each time, so a new one was added rather than
// reused). All of them enforce the same single rule — phone must be globally
// unique — which is wrong: it can't distinguish an active customer from an
// archived one, so it blocks reusing a phone number an archived customer
// used to hold even though the application layer now explicitly allows
// that (see POST/PATCH /customers in oms.routes.js). Dropped here rather
// than left in place; application-level uniqueness (excluding archived
// customers) is the only check going forward.
module.exports = {
  async up(queryInterface) {
    const [constraints] = await queryInterface.sequelize.query(`
      SELECT con.conname
      FROM pg_constraint con
      JOIN pg_class rel ON rel.oid = con.conrelid
      JOIN pg_attribute att ON att.attrelid = rel.oid AND att.attnum = ANY(con.conkey)
      WHERE rel.relname = 'Customers'
        AND att.attname = 'phone'
        AND con.contype = 'u'
    `);
    for (const { conname } of constraints) {
      await queryInterface.sequelize.query(`ALTER TABLE "Customers" DROP CONSTRAINT "${conname}"`);
    }
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addConstraint('Customers', {
      fields: ['phone'],
      type: 'unique',
      name: 'Customers_phone_key',
    });
  },
};
