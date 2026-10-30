'use strict';

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION protect_twif_owner_account()
      RETURNS trigger AS $function$
      BEGIN
        IF TG_OP = 'DELETE' AND OLD.role::text = 'owner' THEN
          RAISE EXCEPTION 'The Owner account cannot be deleted';
        END IF;
        IF TG_OP = 'UPDATE' AND OLD.role::text = 'owner' AND (
          NEW.role::text <> 'owner'
          OR NEW.status::text <> 'active'
          OR NEW.store <> 'all'
        ) THEN
          RAISE EXCEPTION 'The Owner role, status, and store assignment are protected';
        END IF;
        RETURN NEW;
      END;
      $function$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS protect_twif_owner_account_trigger ON "StaffUsers";
      CREATE TRIGGER protect_twif_owner_account_trigger
      BEFORE UPDATE OR DELETE ON "StaffUsers"
      FOR EACH ROW EXECUTE FUNCTION protect_twif_owner_account();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      DROP TRIGGER IF EXISTS protect_twif_owner_account_trigger ON "StaffUsers";
      DROP FUNCTION IF EXISTS protect_twif_owner_account();
    `);
  },
};
