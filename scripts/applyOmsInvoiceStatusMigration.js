'use strict';

require('dotenv').config();
const db = require('../models');

async function run() {
  try {
    await db.sequelize.authenticate();
    await db.sequelize.query("ALTER TYPE \"enum_SentInvoices_paymentStatus\" ADD VALUE IF NOT EXISTS 'unpaid';");
    console.log('Unpaid invoice status is available.');
  } finally {
    await db.sequelize.close();
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
