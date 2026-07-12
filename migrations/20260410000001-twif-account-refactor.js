'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'enum_Users_userType'
        ) THEN
          BEGIN
            ALTER TYPE "enum_Users_userType" RENAME VALUE 'creator' TO 'personal';
          EXCEPTION
            WHEN invalid_parameter_value THEN NULL;
          END;

          BEGIN
            ALTER TYPE "enum_Users_userType" RENAME VALUE 'brand' TO 'business';
          EXCEPTION
            WHEN invalid_parameter_value THEN NULL;
          END;
        END IF;
      END
      $$;
    `);

    await queryInterface.createTable('PersonalProfiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      firstName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      lastName: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      displayName: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      headline: {
        type: Sequelize.STRING(200),
        allowNull: true,
      },
      bio: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      avatarUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      website: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      cvFileName: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      cvFileUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      cvUploadedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      onboardingStep: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      onboardingCompleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      onboardingCompletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.createTable('BusinessProfiles', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.literal('uuid_generate_v4()'),
        primaryKey: true,
      },
      userId: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'Users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      businessName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      contactName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      businessType: {
        type: Sequelize.ENUM('startup', 'sme', 'enterprise', 'agency', 'nonprofit', 'other'),
        allowNull: true,
      },
      industry: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      website: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      phone: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },
      logoUrl: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      onboardingStep: {
        type: Sequelize.INTEGER,
        defaultValue: 1,
      },
      onboardingCompleted: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      onboardingCompletedAt: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updatedAt: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('PersonalProfiles', ['userId'], { unique: true });
    await queryInterface.addIndex('BusinessProfiles', ['userId'], { unique: true });

    await queryInterface.sequelize.query(`
      INSERT INTO "PersonalProfiles" (
        id, "userId", "firstName", "lastName", "displayName", bio, phone,
        "onboardingStep", "onboardingCompleted", "onboardingCompletedAt", "createdAt", "updatedAt"
      )
      SELECT
        uuid_generate_v4(),
        c."userId",
        COALESCE(NULLIF(c."firstName", ''), SPLIT_PART(COALESCE(c."displayName", 'Personal User'), ' ', 1)),
        NULLIF(c."lastName", ''),
        COALESCE(NULLIF(c."displayName", ''), CONCAT_WS(' ', c."firstName", c."lastName")),
        c.bio,
        c.phone,
        COALESCE(c."onboardingStep", 1),
        COALESCE(c."onboardingCompleted", false),
        c."onboardingCompletedAt",
        NOW(),
        NOW()
      FROM "Creators" c
      INNER JOIN "Users" u ON u.id = c."userId"
      WHERE u."userType" = 'personal'
      ON CONFLICT ("userId") DO NOTHING;
    `);

    await queryInterface.sequelize.query(`
      INSERT INTO "BusinessProfiles" (
        id, "userId", "businessName", "contactName", phone, website, description,
        "onboardingStep", "onboardingCompleted", "onboardingCompletedAt", "createdAt", "updatedAt"
      )
      SELECT
        uuid_generate_v4(),
        b."userId",
        COALESCE(NULLIF(b."companyName", ''), 'Business Account'),
        TRIM(CONCAT_WS(' ', b."contactFirstName", b."contactLastName")),
        b.phone,
        b.website,
        b.description,
        COALESCE(b."onboardingStep", 1),
        COALESCE(b."onboardingCompleted", false),
        b."onboardingCompletedAt",
        NOW(),
        NOW()
      FROM "Brands" b
      INNER JOIN "Users" u ON u.id = b."userId"
      WHERE u."userType" = 'business'
      ON CONFLICT ("userId") DO NOTHING;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('BusinessProfiles', ['userId']);
    await queryInterface.removeIndex('PersonalProfiles', ['userId']);
    await queryInterface.dropTable('BusinessProfiles');
    await queryInterface.dropTable('PersonalProfiles');

    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_type
          WHERE typname = 'enum_Users_userType'
        ) THEN
          BEGIN
            ALTER TYPE "enum_Users_userType" RENAME VALUE 'personal' TO 'creator';
          EXCEPTION
            WHEN invalid_parameter_value THEN NULL;
          END;

          BEGIN
            ALTER TYPE "enum_Users_userType" RENAME VALUE 'business' TO 'brand';
          EXCEPTION
            WHEN invalid_parameter_value THEN NULL;
          END;
        END IF;
      END
      $$;
    `);
  },
};
