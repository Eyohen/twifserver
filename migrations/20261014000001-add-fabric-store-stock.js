'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('Fabrics', 'stockByStore', {
      type: Sequelize.JSONB,
      allowNull: false,
      defaultValue: {},
    });

    // Preserve every existing stock count. Prefer the store whose key or name
    // matches the old Location field; stock that was only labelled "Storage"
    // remains visible as storage instead of being silently assigned to a shop.
    const [stores] = await queryInterface.sequelize.query('SELECT "key", "name" FROM "Stores"');
    const [fabrics] = await queryInterface.sequelize.query('SELECT "id", "quantity", "location" FROM "Fabrics" WHERE "quantity" > 0');
    const tidy = (value) => String(value || '').trim().toLowerCase();
    for (const fabric of fabrics) {
      const location = tidy(fabric.location);
      const store = stores.find((entry) => tidy(entry.key) === location || tidy(entry.name) === location);
      const key = store?.key || 'storage';
      await queryInterface.sequelize.query(
        'UPDATE "Fabrics" SET "stockByStore" = CAST(:balances AS JSONB) WHERE "id" = :id',
        { replacements: { balances: JSON.stringify({ [key]: Number(fabric.quantity) }), id: fabric.id } }
      );
    }
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('Fabrics', 'stockByStore');
  },
};
