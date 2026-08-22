'use strict';

// Run once, by hand, after the OAuth install has completed:
//   node scripts/shopifyInitialImport.js
//
// Pages through every existing Shopify customer and runs them through the
// same find-or-create matching logic the webhook handlers use, so a
// customer imported here and later updated via webhook resolves to the
// same profile. After this runs once, the real-time webhooks are the only
// sync path — this script is not meant to run again except to backfill a
// gap (e.g. the app was uninstalled and reinstalled).

require('dotenv').config();
const db = require('../models');
const Encryption = require('../utils/encryption');
const { fetchCustomersPage } = require('../utils/shopifyClient');
const { findOrCreateCustomerFromShopify, recordSyncEvent } = require('../services/shopifySync.service');

async function run() {
  const store = await db.ShopifyStore.findOne({ where: { shopDomain: process.env.SHOPIFY_SHOP_DOMAIN } });
  if (!store) {
    console.error(`No ShopifyStore row for ${process.env.SHOPIFY_SHOP_DOMAIN}. Complete the OAuth install first (GET /api/oms/shopify/install).`);
    process.exitCode = 1;
    return;
  }

  const accessToken = Encryption.decryptApiKey(store.accessTokenEncrypted);
  let pageInfo = null;
  let imported = 0;
  let failed = 0;

  do {
    const { customers, nextPageInfo } = await fetchCustomersPage({
      shop: store.shopDomain,
      accessToken,
      pageInfo,
    });

    for (const shopifyCustomer of customers) {
      try {
        await findOrCreateCustomerFromShopify(shopifyCustomer);
        await recordSyncEvent({
          type: 'customer',
          shopifyId: String(shopifyCustomer.id),
          dedupeKey: `bulk-import:${shopifyCustomer.id}`,
          result: 'success',
          payloadSummary: 'Imported via initial bulk import',
        });
        imported += 1;
      } catch (error) {
        // A repeat run's dedupeKey collision is expected and not a real
        // failure — anything else is.
        if (error.name !== 'SequelizeUniqueConstraintError') {
          failed += 1;
          console.error(`Failed to import Shopify customer ${shopifyCustomer.id}:`, error.message);
        }
      }
    }

    console.log(`Processed ${customers.length} customers (${imported} imported so far, ${failed} failed).`);
    pageInfo = nextPageInfo;
  } while (pageInfo);

  console.log(`Done. ${imported} customers imported, ${failed} failed.`);
  await db.sequelize.close();
}

run().catch((error) => {
  console.error('Bulk import failed:', error);
  process.exitCode = 1;
});
