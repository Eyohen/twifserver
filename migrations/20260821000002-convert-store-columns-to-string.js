'use strict';

// Invoices.store and StaffUsers.store were Postgres enums fixed to exactly
// 'ikeja'/'lekki' (plus 'all'/'production' on staff) — a database-level wall
// against ever adding a third store without a migration. Widening both to a
// plain string is what actually lets the Stores table (see the sibling
// migration) hold new stores the running app can create.
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(
      'ALTER TABLE "Invoices" ALTER COLUMN "store" TYPE VARCHAR(40) USING store::text;'
    );
    // StaffUsers.store has a default ('all'), and Postgres keeps that default
    // expression tied to the old enum type across the TYPE change — dropping
    // the type afterward then fails with "other objects depend on it". The
    // default has to be dropped and reset in plain text around the alter.
    await queryInterface.sequelize.query('ALTER TABLE "StaffUsers" ALTER COLUMN "store" DROP DEFAULT;');
    await queryInterface.sequelize.query(
      'ALTER TABLE "StaffUsers" ALTER COLUMN "store" TYPE VARCHAR(40) USING store::text;'
    );
    await queryInterface.sequelize.query('ALTER TABLE "StaffUsers" ALTER COLUMN "store" SET DEFAULT \'all\';');
    await queryInterface.sequelize.query(
      'ALTER TABLE "SentInvoices" ALTER COLUMN "store" TYPE VARCHAR(40) USING store::text;'
    );
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_Invoices_store";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_StaffUsers_store";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_SentInvoices_store";');
  },

  async down(queryInterface) {
    // Reverting to an enum is unsafe once a store created after this
    // migration ran might already be referenced by live rows.
  },
};
