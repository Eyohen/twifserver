// Script to add publicKey column to Merchants table
// Run with: node scripts/addPublicKey.js

const { Sequelize } = require('sequelize');
const crypto = require('crypto');
require('dotenv').config();

const sequelize = new Sequelize(
  process.env.DB_NAME || 'coin',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'postgres',
  {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    dialect: 'postgres',
    logging: console.log
  }
);

async function addPublicKeyColumn() {
  try {
    console.log('🔄 Twifg to database...');
    await sequelize.authenticate();
    console.log('✅ Connected to database');

    // Step 1: Check if column exists
    const [results] = await sequelize.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'Merchants' AND column_name = 'publicKey'
    `);

    if (results.length === 0) {
      // Step 2: Add the column if it doesn't exist
      console.log('🔄 Adding publicKey column...');
      await sequelize.query(`
        ALTER TABLE "Merchants" ADD COLUMN "publicKey" VARCHAR(255)
      `);
      console.log('✅ publicKey column added');
    } else {
      console.log('ℹ️  publicKey column already exists');
    }

    // Step 3: Generate public keys for merchants that don't have one
    const [merchants] = await sequelize.query(`
      SELECT id FROM "Merchants" WHERE "publicKey" IS NULL
    `);

    console.log(`🔄 Found ${merchants.length} merchants without publicKey`);

    for (const merchant of merchants) {
      const publicKey = 'pk_' + crypto.randomBytes(16).toString('hex');
      await sequelize.query(`
        UPDATE "Merchants" SET "publicKey" = :publicKey WHERE id = :id
      `, {
        replacements: { publicKey, id: merchant.id }
      });
      console.log(`✅ Generated publicKey for merchant ${merchant.id}: ${publicKey}`);
    }

    console.log('\n✅ Done! All merchants now have public keys.');
    console.log('You can now restart your server.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await sequelize.close();
  }
}

addPublicKeyColumn();
