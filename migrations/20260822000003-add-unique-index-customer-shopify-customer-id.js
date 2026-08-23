'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.addIndex('Customers', ['shopifyCustomerId'], {
      unique: true,
      name: 'customers_shopify_customer_id_unique',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeIndex('Customers', 'customers_shopify_customer_id_unique');
  },
};
