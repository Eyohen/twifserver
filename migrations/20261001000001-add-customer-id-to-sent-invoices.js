'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    // No FK constraint, matching the model (SentInvoice.customerId) and the
    // rest of this table's "plain id, not a foreign key" columns (e.g.
    // createdByStaffId) — a customer record being removed must not cascade
    // into an invoice, which is a financial record.
    await queryInterface.addColumn('SentInvoices', 'customerId', {
      type: Sequelize.UUID,
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('SentInvoices', 'customerId');
  },
};
