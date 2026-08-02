'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query("ALTER TYPE \"enum_SentInvoices_paymentStatus\" ADD VALUE IF NOT EXISTS 'unpaid';");
  },

  async down() {
    // PostgreSQL enum values cannot be safely removed while records may use them.
  },
};
