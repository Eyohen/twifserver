'use strict';

// A BEFORE DELETE trigger that returns NEW returns NULL (a deleted row has no
// NEW), and a NULL from a BEFORE trigger silently cancels the operation. The
// original function ended with `RETURN NEW`, so every delete of a non-Owner
// staff account was quietly refused while the API reported success.
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
        IF TG_OP = 'DELETE' THEN
          RETURN OLD;
        END IF;
        RETURN NEW;
      END;
      $function$ LANGUAGE plpgsql;
    `);
  },

  async down() {
    // The previous behaviour was a bug; there is nothing worth restoring.
  },
};
