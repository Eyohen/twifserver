'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Check if columns exist before adding them
    const [paymentsColumns] = await queryInterface.sequelize.query(
      `SELECT column_name FROM information_schema.columns WHERE table_name = 'Payments'`
    );
    const paymentColumnNames = paymentsColumns.map(c => c.column_name);

    // Add missing Payment columns
    if (!paymentColumnNames.includes('requestId')) {
      await queryInterface.addColumn('Payments', 'requestId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'CollaborationRequests', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    if (!paymentColumnNames.includes('creatorId')) {
      await queryInterface.addColumn('Payments', 'creatorId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Creators', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    }

    if (!paymentColumnNames.includes('brandId')) {
      await queryInterface.addColumn('Payments', 'brandId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Brands', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
      });
    }

    if (!paymentColumnNames.includes('contractId')) {
      await queryInterface.addColumn('Payments', 'contractId', {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'Contracts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL'
      });
    }

    if (!paymentColumnNames.includes('platformFee')) {
      await queryInterface.addColumn('Payments', 'platformFee', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      });
    }

    if (!paymentColumnNames.includes('platformFeePercentage')) {
      await queryInterface.addColumn('Payments', 'platformFeePercentage', {
        type: Sequelize.DECIMAL(5, 4),
        allowNull: true,
        defaultValue: 0.10
      });
    }

    if (!paymentColumnNames.includes('creatorPayout')) {
      await queryInterface.addColumn('Payments', 'creatorPayout', {
        type: Sequelize.DECIMAL(15, 2),
        allowNull: true,
        defaultValue: 0
      });
    }

    if (!paymentColumnNames.includes('escrowAt')) {
      await queryInterface.addColumn('Payments', 'escrowAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!paymentColumnNames.includes('escrowReleasedAt')) {
      await queryInterface.addColumn('Payments', 'escrowReleasedAt', {
        type: Sequelize.DATE,
        allowNull: true
      });
    }

    if (!paymentColumnNames.includes('escrowReleasedBy')) {
      await queryInterface.addColumn('Payments', 'escrowReleasedBy', {
        type: Sequelize.UUID,
        allowNull: true
      });
    }

    if (!paymentColumnNames.includes('releaseType')) {
      // First create the enum type if it doesn't exist
      await queryInterface.sequelize.query(`
        DO $$ BEGIN
          CREATE TYPE "enum_Payments_releaseType" AS ENUM ('automatic', 'manual', 'dispute_resolution');
        EXCEPTION
          WHEN duplicate_object THEN null;
        END $$;
      `);

      await queryInterface.addColumn('Payments', 'releaseType', {
        type: Sequelize.ENUM('automatic', 'manual', 'dispute_resolution'),
        allowNull: true
      });
    }

    // Add indexes
    try {
      await queryInterface.addIndex('Payments', ['requestId']);
    } catch (e) { /* Index might already exist */ }

    try {
      await queryInterface.addIndex('Payments', ['creatorId']);
    } catch (e) { /* Index might already exist */ }

    try {
      await queryInterface.addIndex('Payments', ['brandId']);
    } catch (e) { /* Index might already exist */ }

    console.log('Payment columns migration completed');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('Payments', 'requestId');
    await queryInterface.removeColumn('Payments', 'creatorId');
    await queryInterface.removeColumn('Payments', 'brandId');
    await queryInterface.removeColumn('Payments', 'contractId');
    await queryInterface.removeColumn('Payments', 'platformFee');
    await queryInterface.removeColumn('Payments', 'platformFeePercentage');
    await queryInterface.removeColumn('Payments', 'creatorPayout');
    await queryInterface.removeColumn('Payments', 'escrowAt');
    await queryInterface.removeColumn('Payments', 'escrowReleasedAt');
    await queryInterface.removeColumn('Payments', 'escrowReleasedBy');
    await queryInterface.removeColumn('Payments', 'releaseType');
  }
};
