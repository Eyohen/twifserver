'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query('ALTER TABLE "Customers" ALTER COLUMN "phone" DROP NOT NULL;');
  },
  async down(queryInterface) {
    // Reverting to NOT NULL is unsafe if any customer created via Shopify
    // sync since this migration ran has a null phone.
  },
};
