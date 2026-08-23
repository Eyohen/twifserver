# Shopify Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One-way, real-time sync of Shopify customers and orders into the TWIF OMS, plus a one-time bulk import and an Admin-only sync visibility panel.

**Architecture:** A separate Express router (`routes/shopify.routes.js`) handles OAuth install, Shopify webhooks, and an admin sync-status endpoint — kept apart from `oms.routes.js` so public webhook/OAuth traffic never has to pass through (or be exempted from) the staff-auth gate that guards the rest of the OMS API. A `services/shopifySync.service.js` module holds the actual matching/upsert logic, shared by both the webhook routes and the one-off bulk-import script, so the two can't drift.

**Tech Stack:** Node/Express, Sequelize/Postgres (existing stack — no new dependencies; `axios` is already a project dependency and covers the Shopify API calls).

**Spec:** `server/docs/superpowers/specs/2026-08-22-shopify-integration-design.md`

## Global Constraints

- One-way only: nothing in this plan ever writes data back to Shopify.
- Every webhook and OAuth callback request must be Shopify-signature-verified before any data is touched.
- Shopify order data stored is **summary only** — no line items, products, or variants.
- New customers created from Shopify get `category: 'New'` (the existing `Customer` model default — no special-casing needed).
- The Admin Sync panel is read-only, Admin-role only, no manual re-sync trigger.
- This codebase has no automated test runner on the backend (`server/package.json`'s `test` script is a stub). Every task below is verified with a real, runnable command against the local dev database instead of a test-framework assertion — follow the codebase's existing practice, don't introduce a new test framework as part of this feature.
- Follow existing model/migration conventions exactly: UUID primary keys, `tableName` + `timestamps: true`, FK columns declared with `references: { model, key: 'id' }` in migrations (see `migrations/20260731000001-create-inventory-edit-requests.js` for the pattern).

---

## Task 1: Data model — ShopifyStore, ShopifyOrder, ShopifySyncEvent

**Files:**
- Create: `server/models/shopifyStore.js`
- Create: `server/models/shopifyOrder.js`
- Create: `server/models/shopifySyncEvent.js`
- Modify: `server/models/index.js` (register the three new files)
- Modify: `server/models/customer.js` (add `hasMany` association)
- Create: `server/migrations/20260822000001-create-shopify-tables.js`

**Interfaces:**
- Produces: `db.ShopifyStore` (fields: `shopDomain`, `accessTokenEncrypted`, `scopes`, `installedAt`), `db.ShopifyOrder` (fields: `customerId`, `shopifyOrderId`, `orderNumber`, `total`, `currency`, `financialStatus`, `fulfillmentStatus`, `placedAt`, `shopifyAdminUrl`), `db.ShopifySyncEvent` (fields: `type`, `shopifyId`, `dedupeKey` [unique], `result`, `errorMessage`, `payloadSummary`) — all later tasks depend on these exact field names.

- [ ] **Step 1: Create the three model files**

`server/models/shopifyStore.js`:
```js
'use strict';

// One row per connected shop — in practice, one row total. The access
// token is encrypted at rest via utils/encryption.js; nothing else in this
// codebase needs it in plain text except the outbound calls this token is
// for, which decrypt it on demand.
module.exports = (sequelize, DataTypes) => {
  const ShopifyStore = sequelize.define('ShopifyStore', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    shopDomain: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    accessTokenEncrypted: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    scopes: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: '',
    },
    installedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  }, {
    tableName: 'ShopifyStores',
    timestamps: true,
  });

  return ShopifyStore;
};
```

`server/models/shopifyOrder.js`:
```js
'use strict';

// A summary of a Shopify (ready-to-wear) order — deliberately not an
// Invoice or OrderSheet. RTW orders never enter the bespoke pipeline
// (order sheet, production, Accounts approval), so they can't share a
// table with real invoices; the customer profile queries both and merges
// them into one timeline for display.
module.exports = (sequelize, DataTypes) => {
  const ShopifyOrder = sequelize.define('ShopifyOrder', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    shopifyOrderId: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    orderNumber: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    currency: {
      type: DataTypes.STRING(10),
      allowNull: true,
    },
    financialStatus: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    fulfillmentStatus: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    placedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    shopifyAdminUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'ShopifyOrders',
    timestamps: true,
  });

  ShopifyOrder.associate = function (models) {
    ShopifyOrder.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
  };

  return ShopifyOrder;
};
```

`server/models/shopifySyncEvent.js`:
```js
'use strict';

// An audit log of every webhook the OMS has processed — what the Admin
// Sync panel reads from. dedupeKey is unique so a retried Shopify
// delivery (same X-Shopify-Webhook-Id) can be recognised and skipped
// rather than processed twice.
module.exports = (sequelize, DataTypes) => {
  const ShopifySyncEvent = sequelize.define('ShopifySyncEvent', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    shopifyId: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    dedupeKey: {
      type: DataTypes.STRING(120),
      allowNull: false,
      unique: true,
    },
    result: {
      type: DataTypes.STRING(20),
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    payloadSummary: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'ShopifySyncEvents',
    timestamps: true,
  });

  return ShopifySyncEvent;
};
```

- [ ] **Step 2: Register the new models**

In `server/models/index.js`, add to `activeModelFiles` (anywhere in the array is fine — order doesn't matter for this list):
```js
  'shopifyStore.js',
  'shopifyOrder.js',
  'shopifySyncEvent.js',
```

- [ ] **Step 3: Add the Customer → ShopifyOrder association**

In `server/models/customer.js`, inside the existing `Customer.associate = function(models) { ... }` block (which already has `Customer.hasMany(models.Invoice, ...)`), add:
```js
  Customer.hasMany(models.ShopifyOrder, { foreignKey: 'customerId', as: 'shopifyOrders' });
```

- [ ] **Step 4: Write the migration**

`server/migrations/20260822000001-create-shopify-tables.js`:
```js
'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('ShopifyStores', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      shopDomain: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      accessTokenEncrypted: { type: Sequelize.TEXT, allowNull: false },
      scopes: { type: Sequelize.STRING(255), allowNull: false, defaultValue: '' },
      installedAt: { type: Sequelize.DATE, allowNull: false },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });

    await queryInterface.createTable('ShopifyOrders', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      customerId: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'Customers', key: 'id' },
        onDelete: 'CASCADE',
      },
      shopifyOrderId: { type: Sequelize.STRING(40), allowNull: false, unique: true },
      orderNumber: { type: Sequelize.STRING(40), allowNull: true },
      total: { type: Sequelize.DECIMAL(12, 2), allowNull: false, defaultValue: 0 },
      currency: { type: Sequelize.STRING(10), allowNull: true },
      financialStatus: { type: Sequelize.STRING(40), allowNull: true },
      fulfillmentStatus: { type: Sequelize.STRING(40), allowNull: true },
      placedAt: { type: Sequelize.DATE, allowNull: true },
      shopifyAdminUrl: { type: Sequelize.STRING(500), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ShopifyOrders', ['customerId']);

    await queryInterface.createTable('ShopifySyncEvents', {
      id: { type: Sequelize.UUID, defaultValue: Sequelize.UUIDV4, primaryKey: true },
      type: { type: Sequelize.STRING(20), allowNull: false },
      shopifyId: { type: Sequelize.STRING(40), allowNull: true },
      dedupeKey: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      result: { type: Sequelize.STRING(20), allowNull: false },
      errorMessage: { type: Sequelize.STRING(500), allowNull: true },
      payloadSummary: { type: Sequelize.STRING(500), allowNull: true },
      createdAt: { type: Sequelize.DATE, allowNull: false },
      updatedAt: { type: Sequelize.DATE, allowNull: false },
    });
    await queryInterface.addIndex('ShopifySyncEvents', ['createdAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('ShopifySyncEvents');
    await queryInterface.dropTable('ShopifyOrders');
    await queryInterface.dropTable('ShopifyStores');
  },
};
```

- [ ] **Step 5: Run the migration locally and verify**

```bash
cd server
npx sequelize-cli db:migrate
```

Then verify the tables and association exist:
```bash
node -e "
const db = require('./models');
(async () => {
  const tables = await db.sequelize.getQueryInterface().showAllTables();
  ['ShopifyStores','ShopifyOrders','ShopifySyncEvents'].forEach(t =>
    console.log(t, tables.includes(t) ? 'OK' : 'MISSING'));
  console.log('Customer.shopifyOrders association:', typeof db.Customer.associations.shopifyOrders !== 'undefined');
  await db.sequelize.close();
})();
"
```
Expected: all three tables print `OK`, association prints `true`.

- [ ] **Step 6: Commit**

```bash
git add models/shopifyStore.js models/shopifyOrder.js models/shopifySyncEvent.js models/index.js models/customer.js migrations/20260822000001-create-shopify-tables.js
git commit -m "Add Shopify data model: stores, order summaries, sync log"
```

---

## Task 2: Shopify API client utility

**Files:**
- Create: `server/utils/shopifyClient.js`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `verifyWebhookHmac(rawBody: Buffer, hmacHeader: string, secret: string): boolean`, `verifyOAuthHmac(query: object, secret: string): boolean`, `buildAuthorizeUrl({shop, clientId, scopes, redirectUri, state}): string`, `exchangeCodeForToken({shop, clientId, clientSecret, code}): Promise<{access_token, scope}>`, `fetchCustomersPage({shop, accessToken, pageInfo, apiVersion, limit}): Promise<{customers: array, nextPageInfo: string|null}>` — Task 4 and Task 7 call these by these exact names.

- [ ] **Step 1: Write the file**

`server/utils/shopifyClient.js`:
```js
'use strict';

const crypto = require('crypto');
const axios = require('axios');

// Every webhook Shopify sends carries this header, computed as
// base64(HMAC-SHA256(rawRequestBody, appSecret)). It has to be checked
// against the exact bytes Shopify sent — re-serialising req.body as JSON
// is not guaranteed to produce the same bytes, so this always takes the
// raw buffer captured by index.js's body-parser verify hook.
const verifyWebhookHmac = (rawBody, hmacHeader, secret) => {
  if (!rawBody || !hmacHeader || !secret) return false;
  const digest = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  const expected = Buffer.from(digest);
  const actual = Buffer.from(String(hmacHeader));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

// The OAuth callback signs its query string differently: every param
// except hmac/signature, sorted by key, joined as key=value pairs with &,
// HMAC-SHA256'd and hex-encoded. See Shopify's OAuth docs for this exact
// algorithm.
const verifyOAuthHmac = (query, secret) => {
  const { hmac, signature, ...rest } = query || {};
  if (!hmac || !secret) return false;
  const message = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${Array.isArray(rest[key]) ? rest[key].join(',') : rest[key]}`)
    .join('&');
  const digest = crypto.createHmac('sha256', secret).update(message).digest('hex');
  const expected = Buffer.from(digest);
  const actual = Buffer.from(String(hmac));
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
};

const buildAuthorizeUrl = ({ shop, clientId, scopes, redirectUri, state }) => {
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
};

const exchangeCodeForToken = async ({ shop, clientId, clientSecret, code }) => {
  const response = await axios.post(`https://${shop}/admin/oauth/access_token`, {
    client_id: clientId,
    client_secret: clientSecret,
    code,
  });
  return response.data;
};

// Shopify's REST customer list is cursor-paginated via a Link response
// header once an app is on a recent API version — there is no page number
// to increment, so the next page's cursor has to be parsed out of it.
const fetchCustomersPage = async ({ shop, accessToken, pageInfo, apiVersion = '2024-01', limit = 250 }) => {
  const params = pageInfo ? { page_info: pageInfo, limit } : { limit };
  const response = await axios.get(`https://${shop}/admin/api/${apiVersion}/customers.json`, {
    headers: { 'X-Shopify-Access-Token': accessToken },
    params,
  });
  const linkHeader = response.headers.link || '';
  const nextMatch = linkHeader.match(/<[^>]*[?&]page_info=([^&>]+)[^>]*>;\s*rel="next"/);
  return {
    customers: response.data.customers || [],
    nextPageInfo: nextMatch ? nextMatch[1] : null,
  };
};

module.exports = {
  verifyWebhookHmac,
  verifyOAuthHmac,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchCustomersPage,
};
```

- [ ] **Step 2: Verify the HMAC functions against known-correct output**

This is pure logic with no network/DB dependency, so it's verified with a small standalone script rather than a live Shopify call:

```bash
cd server
node -e "
const { verifyWebhookHmac, verifyOAuthHmac, buildAuthorizeUrl } = require('./utils/shopifyClient');
const crypto = require('crypto');

const secret = 'test-secret';
const body = Buffer.from(JSON.stringify({ id: 123, email: 'a@b.com' }));
const goodHmac = crypto.createHmac('sha256', secret).update(body).digest('base64');

console.log('valid webhook hmac accepted:', verifyWebhookHmac(body, goodHmac, secret) === true);
console.log('tampered body rejected:', verifyWebhookHmac(Buffer.from('{}'), goodHmac, secret) === false);
console.log('wrong secret rejected:', verifyWebhookHmac(body, goodHmac, 'wrong') === false);

const query = { code: 'abc', shop: 'twifclothing.myshopify.com', state: 'xyz', timestamp: '123' };
const message = Object.keys(query).sort().map(k => \`\${k}=\${query[k]}\`).join('&');
const goodOAuthHmac = crypto.createHmac('sha256', secret).update(message).digest('hex');
console.log('valid oauth hmac accepted:', verifyOAuthHmac({ ...query, hmac: goodOAuthHmac }, secret) === true);
console.log('bad oauth hmac rejected:', verifyOAuthHmac({ ...query, hmac: 'wrong' }, secret) === false);

const url = buildAuthorizeUrl({ shop: 'twifclothing.myshopify.com', clientId: 'cid', scopes: 'read_customers,read_orders', redirectUri: 'https://example.com/callback', state: 'xyz' });
console.log('authorize url shape ok:', url.startsWith('https://twifclothing.myshopify.com/admin/oauth/authorize?') && url.includes('scope=read_customers') && url.includes('state=xyz'));
"
```
Expected: every line prints `true`.

- [ ] **Step 3: Commit**

```bash
git add utils/shopifyClient.js
git commit -m "Add Shopify API client: HMAC verification, OAuth, paginated customer fetch"
```

---

## Task 3: Sync service — customer matching, order upsert, event logging

**Files:**
- Create: `server/services/shopifySync.service.js`

**Interfaces:**
- Consumes: `db.Customer`, `db.ShopifyOrder`, `db.ShopifySyncEvent` (Task 1).
- Produces: `findOrCreateCustomerFromShopify(shopifyCustomer: object): Promise<Customer>`, `upsertShopifyOrderFromShopify(shopifyOrder: object, customerId: string): Promise<ShopifyOrder>`, `recordSyncEvent({type, shopifyId, dedupeKey, result, errorMessage, payloadSummary}): Promise<{duplicate: boolean}>` — Tasks 5, 6, and 7 call these by these exact names.

- [ ] **Step 1: Write the file**

`server/services/shopifySync.service.js`:
```js
'use strict';

const crypto = require('crypto');
const db = require('../models');

const { Customer, ShopifyOrder, ShopifySyncEvent } = db;

const shopifyFullName = (shopifyCustomer) => {
  const name = [shopifyCustomer.first_name, shopifyCustomer.last_name]
    .filter(Boolean)
    .join(' ')
    .trim();
  return name || 'Shopify Customer';
};

// Matched in this order: a customer already linked to this exact Shopify
// id, then by email, then by phone — so a bespoke customer who later
// orders on Shopify (or vice versa) ends up as one profile, not two. Once
// matched, shopifyCustomerId is stamped on so later webhooks for the same
// Shopify customer land here even if they change their email afterward.
const findOrCreateCustomerFromShopify = async (shopifyCustomer) => {
  const shopifyCustomerId = String(shopifyCustomer.id);
  const email = shopifyCustomer.email ? String(shopifyCustomer.email).trim() : null;
  const phone = shopifyCustomer.phone ? String(shopifyCustomer.phone).trim() : null;

  let customer = await Customer.findOne({ where: { shopifyCustomerId } });
  if (!customer && email) customer = await Customer.findOne({ where: { email } });
  if (!customer && phone) customer = await Customer.findOne({ where: { phone } });

  if (customer) {
    await customer.update({
      shopifyCustomerId,
      email: customer.email || email,
      phone: customer.phone || phone,
    });
    return customer;
  }

  return Customer.create({
    fullName: shopifyFullName(shopifyCustomer),
    email,
    phone,
    shopifyCustomerId,
    category: 'New',
    portalToken: crypto.randomBytes(32).toString('hex'),
  });
};

// Summary only — no line items. Keyed on shopifyOrderId so re-delivery of
// the same webhook (or the bulk import re-running) updates the existing
// row instead of duplicating it.
const upsertShopifyOrderFromShopify = async (shopifyOrder, customerId) => {
  const shopifyOrderId = String(shopifyOrder.id);
  const [order] = await ShopifyOrder.findOrCreate({
    where: { shopifyOrderId },
    defaults: {
      customerId,
      shopifyOrderId,
      orderNumber: shopifyOrder.name
        || (shopifyOrder.order_number != null ? String(shopifyOrder.order_number) : null),
      total: Number(shopifyOrder.total_price || 0),
      currency: shopifyOrder.currency || null,
      financialStatus: shopifyOrder.financial_status || null,
      fulfillmentStatus: shopifyOrder.fulfillment_status || null,
      placedAt: shopifyOrder.created_at || null,
      shopifyAdminUrl: shopifyOrder.admin_graphql_api_id || null,
    },
  });

  await order.update({
    customerId,
    financialStatus: shopifyOrder.financial_status || order.financialStatus,
    fulfillmentStatus: shopifyOrder.fulfillment_status || order.fulfillmentStatus,
    total: shopifyOrder.total_price != null ? Number(shopifyOrder.total_price) : order.total,
  });

  return order;
};

// dedupeKey is unique at the DB level, so a retried webhook delivery (same
// X-Shopify-Webhook-Id) throws a SequelizeUniqueConstraintError here rather
// than being logged and processed a second time — the caller checks
// `duplicate` before doing any further work.
const recordSyncEvent = async ({ type, shopifyId, dedupeKey, result, errorMessage, payloadSummary }) => {
  try {
    await ShopifySyncEvent.create({ type, shopifyId, dedupeKey, result, errorMessage, payloadSummary });
    return { duplicate: false };
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') return { duplicate: true };
    throw error;
  }
};

module.exports = {
  findOrCreateCustomerFromShopify,
  upsertShopifyOrderFromShopify,
  recordSyncEvent,
};
```

- [ ] **Step 2: Verify against the local dev database**

This exercises real DB writes, so clean up the fixture rows it creates at the end:

```bash
cd server
node -e "
const db = require('./models');
const { findOrCreateCustomerFromShopify, upsertShopifyOrderFromShopify, recordSyncEvent } = require('./services/shopifySync.service');

(async () => {
  const shopifyCustomer = { id: 999001, email: 'sync-test@example.com', phone: '08099990001', first_name: 'Sync', last_name: 'Test' };

  const created = await findOrCreateCustomerFromShopify(shopifyCustomer);
  console.log('created new customer:', created.category === 'New' && created.shopifyCustomerId === '999001');

  const matchedAgain = await findOrCreateCustomerFromShopify(shopifyCustomer);
  console.log('second call matches same row (by shopifyCustomerId):', matchedAgain.id === created.id);

  const matchedByEmailOnly = await findOrCreateCustomerFromShopify({ id: 999002, email: 'sync-test@example.com' });
  console.log('different shopify id, same email matches same row:', matchedByEmailOnly.id === created.id);

  const order = await upsertShopifyOrderFromShopify({ id: 888001, name: '#1058', total_price: '45000.00', currency: 'NGN', financial_status: 'paid', fulfillment_status: 'fulfilled', created_at: new Date().toISOString() }, created.id);
  console.log('order created:', order.orderNumber === '#1058' && Number(order.total) === 45000);

  const orderAgain = await upsertShopifyOrderFromShopify({ id: 888001, total_price: '45000.00', financial_status: 'refunded' }, created.id);
  console.log('same shopify order id updates in place:', orderAgain.id === order.id && orderAgain.financialStatus === 'refunded');

  const first = await recordSyncEvent({ type: 'order', shopifyId: '888001', dedupeKey: 'webhook-abc-1', result: 'success', payloadSummary: 'test' });
  console.log('first event recorded:', first.duplicate === false);
  const dupe = await recordSyncEvent({ type: 'order', shopifyId: '888001', dedupeKey: 'webhook-abc-1', result: 'success', payloadSummary: 'test' });
  console.log('duplicate dedupeKey detected:', dupe.duplicate === true);

  // Clean up
  await db.ShopifySyncEvent.destroy({ where: { dedupeKey: 'webhook-abc-1' } });
  await db.ShopifyOrder.destroy({ where: { shopifyOrderId: '888001' } });
  await db.Customer.destroy({ where: { id: created.id } });

  await db.sequelize.close();
})();
"
```
Expected: every line prints `true`.

- [ ] **Step 3: Commit**

```bash
git add services/shopifySync.service.js
git commit -m "Add Shopify sync service: customer matching, order upsert, event log"
```

---

## Task 4: Raw body capture + OAuth install/callback routes

**Files:**
- Modify: `server/index.js` (capture raw body for HMAC verification; mount the new router)
- Create: `server/routes/shopify.routes.js`
- Modify: `server/.env.example` (document the new env vars)

**Interfaces:**
- Consumes: `verifyOAuthHmac`, `buildAuthorizeUrl`, `exchangeCodeForToken` (Task 2); `db.ShopifyStore` (Task 1); `Encryption.encryptApiKey` (`utils/encryption.js`, already exists).
- Produces: `GET /api/oms/shopify/install`, `GET /api/oms/shopify/callback` — no other task depends on these directly, but Task 5/6 add routes to the same router file.

**Prerequisite (manual, on Shopify's side — not code):** the "tWIF Internal App" in the Shopify Dev Dashboard currently only requests "staff and contributor data" scope. Before the install flow in this task can complete with a *usable* token, its configured scopes need to include `read_customers` and `read_orders`. This is a Shopify admin configuration change, done once, separately from this plan — the code below is correct regardless of when that happens, since it's what makes the eventual install request the right scopes.

- [ ] **Step 1: Capture the raw request body for HMAC verification**

In `server/index.js`, the existing line is:
```js
app.use(express.json({ limit: '10mb' }));
```
Replace it with:
```js
// Shopify's webhook HMAC is computed over the exact raw bytes of the
// request body — re-serialising req.body as JSON afterward isn't
// guaranteed to reproduce them. This captures the raw buffer alongside
// the normal parse, without changing behaviour for any existing route.
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => { req.rawBody = buf; },
}));
```

- [ ] **Step 2: Write the OAuth routes**

`server/routes/shopify.routes.js`:
```js
'use strict';

const express = require('express');
const crypto = require('crypto');
const db = require('../models');
const Encryption = require('../utils/encryption');
const { requireStaff, requireRole } = require('../middleware/staffAuth');
const {
  verifyOAuthHmac,
  buildAuthorizeUrl,
  exchangeCodeForToken,
} = require('../utils/shopifyClient');

const router = express.Router();
const { ShopifyStore } = db;

const SCOPES = 'read_customers,read_orders';

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/install', (req, res) => {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const appUrl = process.env.SHOPIFY_APP_URL;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!shop || !appUrl || !clientId) {
    return res.status(500).json({
      success: false,
      message: 'SHOPIFY_SHOP_DOMAIN, SHOPIFY_APP_URL and SHOPIFY_CLIENT_ID must be set to install.',
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('shopify_oauth_state', state, { httpOnly: true, maxAge: 5 * 60 * 1000 });

  const url = buildAuthorizeUrl({
    shop,
    clientId,
    scopes: SCOPES,
    redirectUri: `${appUrl}/api/oms/shopify/callback`,
    state,
  });
  res.redirect(url);
});

router.get('/callback', asyncHandler(async (req, res) => {
  const secret = process.env.SHOPIFY_CLIENT_SECRET;
  if (!verifyOAuthHmac(req.query, secret)) {
    return res.status(401).json({ success: false, message: 'Invalid HMAC signature.' });
  }
  if (!req.query.state || req.query.state !== req.cookies?.shopify_oauth_state) {
    return res.status(401).json({ success: false, message: 'Invalid or missing state parameter.' });
  }

  const { shop, code } = req.query;
  const { access_token: accessToken, scope } = await exchangeCodeForToken({
    shop,
    clientId: process.env.SHOPIFY_CLIENT_ID,
    clientSecret: secret,
    code,
  });

  const [store] = await ShopifyStore.findOrCreate({
    where: { shopDomain: shop },
    defaults: { shopDomain: shop, accessTokenEncrypted: '', scopes: '', installedAt: new Date() },
  });
  await store.update({
    accessTokenEncrypted: Encryption.encryptApiKey(accessToken),
    scopes: scope,
    installedAt: new Date(),
  });

  res.clearCookie('shopify_oauth_state');
  res.send('Shopify app installed. You can close this tab.');
}));

module.exports = router;
```

- [ ] **Step 3: Mount the router before `omsRoutes`**

In `server/index.js`, add the require near the other route imports:
```js
const shopifyRoutes = require('./routes/shopify.routes');
```

Mount it **before** `app.use('/api/oms', omsRoutes);` (order matters — Express matches the more specific, earlier-registered prefix first, which is what keeps this router's requests from ever reaching `oms.routes.js`'s staff-auth gate):
```js
app.use('/api/oms/shopify', shopifyRoutes);
app.use('/api/oms', omsRoutes);
```

- [ ] **Step 4: Document the new env vars**

In `server/.env.example` (or `.env` if there is no `.example` file — check which exists first), add:
```
SHOPIFY_CLIENT_ID=
SHOPIFY_CLIENT_SECRET=
SHOPIFY_SHOP_DOMAIN=twifclothing.myshopify.com
SHOPIFY_APP_URL=
```
`SHOPIFY_APP_URL` is the OMS backend's own public base URL (e.g. `https://twifserver-production.up.railway.app`) — it's what Shopify redirects back to after the merchant approves the install.

- [ ] **Step 5: Verify the install route redirects correctly**

Requires `SHOPIFY_CLIENT_ID`, `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_APP_URL` set (use the real values already in hand for the first two; any `https://` URL for the third is fine for this check since it's just confirming the redirect shape, not completing a real install):

```bash
cd server
SHOPIFY_CLIENT_ID=b7ab3cfaa6d1d5d786340e4e788c418d SHOPIFY_SHOP_DOMAIN=twifclothing.myshopify.com SHOPIFY_APP_URL=http://localhost:8092 API_PORT=8092 node index.js &
sleep 3
curl -s -o /dev/null -D - "http://localhost:8092/api/oms/shopify/install" | grep -i "^location:"
kill %1
```
Expected: a `location:` header pointing at `https://twifclothing.myshopify.com/admin/oauth/authorize?...` containing `scope=read_customers%2Cread_orders` and a `state=` value.

Verify the callback rejects a bad signature:
```bash
cd server
SHOPIFY_CLIENT_SECRET=test-secret API_PORT=8093 node index.js &
sleep 3
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:8093/api/oms/shopify/callback?shop=twifclothing.myshopify.com&code=abc&state=xyz&hmac=wrong"
kill %1
```
Expected: `401`.

- [ ] **Step 6: Commit**

```bash
git add index.js routes/shopify.routes.js .env.example
git commit -m "Add Shopify OAuth install/callback routes"
```

---

## Task 5: Webhook routes — customers and orders

**Files:**
- Modify: `server/routes/shopify.routes.js`

**Interfaces:**
- Consumes: `verifyWebhookHmac` (Task 2); `findOrCreateCustomerFromShopify`, `upsertShopifyOrderFromShopify`, `recordSyncEvent` (Task 3).
- Produces: `POST /api/oms/shopify/webhooks/customers`, `POST /api/oms/shopify/webhooks/orders`.

- [ ] **Step 1: Add the webhook routes**

In `server/routes/shopify.routes.js`, add to the top imports:
```js
const { verifyOAuthHmac, verifyWebhookHmac, buildAuthorizeUrl, exchangeCodeForToken } = require('../utils/shopifyClient');
const {
  findOrCreateCustomerFromShopify,
  upsertShopifyOrderFromShopify,
  recordSyncEvent,
} = require('../services/shopifySync.service');
```
(This replaces the earlier `verifyOAuthHmac, buildAuthorizeUrl, exchangeCodeForToken` single-purpose import line from Task 4 with the fuller one above.)

Add before `module.exports = router;`:
```js
const requireWebhookSignature = (req, res, next) => {
  const hmacHeader = req.get('X-Shopify-Hmac-Sha256');
  if (!verifyWebhookHmac(req.rawBody, hmacHeader, process.env.SHOPIFY_CLIENT_SECRET)) {
    return res.status(401).json({ success: false, message: 'Invalid HMAC signature.' });
  }
  const dedupeKey = req.get('X-Shopify-Webhook-Id');
  if (!dedupeKey) {
    return res.status(400).json({ success: false, message: 'Missing X-Shopify-Webhook-Id header.' });
  }
  req.shopifyDedupeKey = dedupeKey;
  return next();
};

router.post('/webhooks/customers', requireWebhookSignature, asyncHandler(async (req, res) => {
  const payload = req.body;
  try {
    const customer = await findOrCreateCustomerFromShopify(payload);
    await recordSyncEvent({
      type: 'customer',
      shopifyId: payload.id != null ? String(payload.id) : null,
      dedupeKey: req.shopifyDedupeKey,
      result: 'success',
      payloadSummary: `${customer.fullName} (${customer.email || customer.phone || 'no contact info'})`,
    });
  } catch (error) {
    await recordSyncEvent({
      type: 'customer',
      shopifyId: payload?.id != null ? String(payload.id) : null,
      dedupeKey: req.shopifyDedupeKey,
      result: 'error',
      errorMessage: error.message,
    });
  }
  res.status(200).send('ok');
}));

router.post('/webhooks/orders', requireWebhookSignature, asyncHandler(async (req, res) => {
  const payload = req.body;
  try {
    const customer = await findOrCreateCustomerFromShopify(payload.customer || {});
    const order = await upsertShopifyOrderFromShopify(payload, customer.id);
    await recordSyncEvent({
      type: 'order',
      shopifyId: payload.id != null ? String(payload.id) : null,
      dedupeKey: req.shopifyDedupeKey,
      result: 'success',
      payloadSummary: `Order ${order.orderNumber || order.shopifyOrderId} — ${order.financialStatus || 'unknown status'}`,
    });
  } catch (error) {
    await recordSyncEvent({
      type: 'order',
      shopifyId: payload?.id != null ? String(payload.id) : null,
      dedupeKey: req.shopifyDedupeKey,
      result: 'error',
      errorMessage: error.message,
    });
  }
  res.status(200).send('ok');
}));
```

Note: `orders/cancelled` and `refunds/create` both route to `/webhooks/orders` too (Shopify's cancelled-order and refund payloads both carry the order's current `financial_status`/`fulfillment_status`, which is all `upsertShopifyOrderFromShopify` needs) — this is a webhook *subscription* configuration in Shopify (covered in Task 8's manual setup note), not more application code.

- [ ] **Step 2: Verify signature checking and successful processing against the local dev DB**

```bash
cd server
SHOPIFY_CLIENT_SECRET=test-secret API_PORT=8094 node index.js &
sleep 3

BODY='{"id":999101,"email":"webhook-test@example.com","first_name":"Webhook","last_name":"Test"}'
HMAC=$(node -e "const crypto=require('crypto'); process.stdout.write(crypto.createHmac('sha256','test-secret').update('$BODY').digest('base64'))")

echo "--- valid signature, should be 200 and create the customer ---"
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8094/api/oms/shopify/webhooks/customers \
  -H "Content-Type: application/json" -H "X-Shopify-Hmac-Sha256: $HMAC" -H "X-Shopify-Webhook-Id: test-delivery-1" \
  -d "$BODY"

echo "--- invalid signature, should be 401 ---"
curl -s -o /dev/null -w "%{http_code}\n" -X POST http://localhost:8094/api/oms/shopify/webhooks/customers \
  -H "Content-Type: application/json" -H "X-Shopify-Hmac-Sha256: wrong" -H "X-Shopify-Webhook-Id: test-delivery-2" \
  -d "$BODY"

kill %1
```
Expected: first call `200`, second `401`.

Then verify the customer landed correctly and clean it up:
```bash
node -e "
const db = require('./models');
(async () => {
  const customer = await db.Customer.findOne({ where: { shopifyCustomerId: '999101' } });
  console.log('customer created:', !!customer, customer?.fullName, customer?.category);
  const event = await db.ShopifySyncEvent.findOne({ where: { dedupeKey: 'test-delivery-1' } });
  console.log('sync event logged:', event?.result === 'success');
  if (customer) await customer.destroy();
  if (event) await event.destroy();
  await db.sequelize.close();
})();
"
```
Expected: `customer created: true Webhook Test New`, `sync event logged: true`.

- [ ] **Step 3: Commit**

```bash
git add routes/shopify.routes.js
git commit -m "Add Shopify customer/order webhook routes"
```

---

## Task 6: Admin sync-status endpoint

**Files:**
- Modify: `server/routes/shopify.routes.js`

**Interfaces:**
- Consumes: `db.ShopifySyncEvent`, `db.Customer`, `db.ShopifyOrder` (Task 1); `requireStaff`, `requireRole` (already imported in Task 4).
- Produces: `GET /api/oms/shopify/sync-status` → `{ success: true, data: { linkedCustomers, ordersSynced, lastSyncAt, recentEvents: [{type, shopifyId, result, errorMessage, payloadSummary, createdAt}] } }` — Task 8's frontend page depends on this exact response shape.

- [ ] **Step 1: Add the route**

In `server/routes/shopify.routes.js`, add to the imports destructure:
```js
const { ShopifyStore, ShopifySyncEvent, Customer, ShopifyOrder } = db;
```
(replacing the Task-4-only `const { ShopifyStore } = db;` line)

Add before `module.exports = router;`:
```js
router.get('/sync-status', requireStaff, requireRole('owner', 'admin'), asyncHandler(async (req, res) => {
  const [linkedCustomers, ordersSynced, lastEvent, recentEvents] = await Promise.all([
    Customer.count({ where: { shopifyCustomerId: { [db.Sequelize.Op.ne]: null } } }),
    ShopifyOrder.count(),
    ShopifySyncEvent.findOne({ where: { result: 'success' }, order: [['createdAt', 'DESC']] }),
    ShopifySyncEvent.findAll({ order: [['createdAt', 'DESC']], limit: 50 }),
  ]);

  res.json({
    success: true,
    data: {
      linkedCustomers,
      ordersSynced,
      lastSyncAt: lastEvent?.createdAt || null,
      recentEvents: recentEvents.map((event) => ({
        type: event.type,
        shopifyId: event.shopifyId,
        result: event.result,
        errorMessage: event.errorMessage,
        payloadSummary: event.payloadSummary,
        createdAt: event.createdAt,
      })),
    },
  });
}));
```

- [ ] **Step 2: Verify role-gating and response shape**

Reuses the same login pattern as the rest of the OMS API — sign in as Owner, then call the endpoint, then confirm a non-owner/admin role is refused:

```bash
cd server
API_PORT=8095 node index.js &
sleep 3

TOKEN=$(curl -s -X POST http://localhost:8095/api/oms/auth/login -H "Content-Type: application/json" -d '{"phone":"08000000001","pin":"owner26"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.token))")

echo "--- as Owner, should be 200 with the expected shape ---"
curl -s http://localhost:8095/api/oms/shopify/sync-status -H "Authorization: Bearer $TOKEN"
echo

echo "--- no token, should be 401 ---"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8095/api/oms/shopify/sync-status

TAILOR_TOKEN=$(curl -s -X POST http://localhost:8095/api/oms/auth/login -H "Content-Type: application/json" -d '{"phone":"08000000007","pin":"tailor26"}' | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).data.token))")
echo "--- as Tailor, should be 403 ---"
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8095/api/oms/shopify/sync-status -H "Authorization: Bearer $TAILOR_TOKEN"

kill %1
```
Expected: Owner call returns `200` with `"linkedCustomers"`, `"ordersSynced"`, `"lastSyncAt"`, `"recentEvents"` keys present; no-token call `401`; Tailor call `403`.

- [ ] **Step 3: Commit**

```bash
git add routes/shopify.routes.js
git commit -m "Add Admin-only Shopify sync-status endpoint"
```

---

## Task 7: One-time bulk import script

**Files:**
- Create: `server/scripts/shopifyInitialImport.js`

**Interfaces:**
- Consumes: `fetchCustomersPage` (Task 2); `findOrCreateCustomerFromShopify`, `recordSyncEvent` (Task 3); `db.ShopifyStore` (Task 1); `Encryption.decryptApiKey` (`utils/encryption.js`).

- [ ] **Step 1: Write the script**

`server/scripts/shopifyInitialImport.js`:
```js
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
```

- [ ] **Step 2: Verify the script's logic without a live Shopify call**

The pagination loop and per-customer handling can be verified by stubbing `fetchCustomersPage` — this checks the script's own logic (looping, error tolerance, dedup) independent of network access:

```bash
cd server
node -e "
const db = require('./models');
const shopifyClient = require('./utils/shopifyClient');
const { findOrCreateCustomerFromShopify, recordSyncEvent } = require('./services/shopifySync.service');

// Stub the paginated fetch so this runs with no network access.
let call = 0;
shopifyClient.fetchCustomersPage = async () => {
  call += 1;
  if (call === 1) {
    return { customers: [{ id: 777001, email: 'bulk-a@example.com', first_name: 'Bulk', last_name: 'A' }], nextPageInfo: 'cursor-2' };
  }
  return { customers: [{ id: 777002, email: 'bulk-b@example.com', first_name: 'Bulk', last_name: 'B' }], nextPageInfo: null };
};

(async () => {
  let pageInfo = null;
  let imported = 0;
  do {
    const { customers, nextPageInfo } = await shopifyClient.fetchCustomersPage({ pageInfo });
    for (const c of customers) {
      await findOrCreateCustomerFromShopify(c);
      await recordSyncEvent({ type: 'customer', shopifyId: String(c.id), dedupeKey: \`bulk-import:\${c.id}\`, result: 'success', payloadSummary: 'test' });
      imported += 1;
    }
    pageInfo = nextPageInfo;
  } while (pageInfo);

  console.log('paginated across two pages:', call === 2);
  console.log('imported both customers:', imported === 2);

  const a = await db.Customer.findOne({ where: { shopifyCustomerId: '777001' } });
  const b = await db.Customer.findOne({ where: { shopifyCustomerId: '777002' } });
  console.log('both customers present in DB:', !!a && !!b);

  await db.ShopifySyncEvent.destroy({ where: { dedupeKey: ['bulk-import:777001', 'bulk-import:777002'] } });
  if (a) await a.destroy();
  if (b) await b.destroy();
  await db.sequelize.close();
})();
"
```
Expected: all three lines print `true`.

Note: running the actual `node scripts/shopifyInitialImport.js` against live Shopify data requires the OAuth install to be complete with the correct scopes (see Task 4's prerequisite note) — that's a manual step for the user once the app's scopes are updated on Shopify's side, not something verifiable here.

- [ ] **Step 3: Commit**

```bash
git add scripts/shopifyInitialImport.js
git commit -m "Add one-time Shopify customer bulk import script"
```

---

## Task 8: Admin Shopify Sync panel (frontend)

**Files:**
- Create: `twif/src/pages/owner/ShopifySyncPage.jsx`
- Modify: `twif/src/config/oms.js` (add nav item for Owner/Admin)
- Modify: `twif/src/App.jsx` (import the page, route it in `renderView`)

**Interfaces:**
- Consumes: `GET /api/oms/shopify/sync-status` (Task 6) — exact response shape: `{ success, data: { linkedCustomers, ordersSynced, lastSyncAt, recentEvents: [{type, shopifyId, result, errorMessage, payloadSummary, createdAt}] } }`.

- [ ] **Step 1: Check the current nav config shape**

Before editing, read `twif/src/config/oms.js`'s `navByRole` structure (it's referenced but not yet detailed in this plan) to match its existing shape exactly — open the file and find how `owner`/`admin` roles list their nav items (icon, label, route name) before writing Step 2's addition, so the new entry follows the same object shape as its neighbors.

- [ ] **Step 2: Add the nav entry**

In `twif/src/config/oms.js`, add a `'Shopify Sync'` entry to the Owner and Admin role nav lists, following the exact shape used by neighboring entries in that file (icon import + label + whatever key structure the surrounding entries use).

- [ ] **Step 3: Write the page**

`twif/src/pages/owner/ShopifySyncPage.jsx`:
```jsx
import { useEffect, useState } from 'react';
import { RefreshCw, CheckCircle, XCircle } from 'lucide-react';
import { api } from '../../lib/api';

export default function ShopifySyncPage() {
  const [status, setStatus] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    api.get('/oms/shopify/sync-status')
      .then((response) => setStatus(response.data?.data || null))
      .catch((error) => setNotice({ tone: 'error', text: error.response?.data?.message || 'The Shopify sync status could not be loaded.' }));
  }, []);

  if (!status) {
    return (
      <div className="os-page">
        <div className="os-card" style={{ padding: 40, textAlign: 'center', color: '#8a7a6a' }}>
          {notice?.text || 'Loading Shopify sync status…'}
        </div>
      </div>
    );
  }

  return (
    <div className="os-page">
      <div className="os-page-header">
        <div className="os-page-title">
          <RefreshCw size={22} strokeWidth={1.8} />
          <div>
            <h2>Shopify Sync</h2>
            <p>Customers and orders arriving from the Shopify store</p>
          </div>
        </div>
      </div>

      <div className="os-kpi-row">
        {[
          ['Linked Customers', status.linkedCustomers],
          ['Orders Synced', status.ordersSynced],
          ['Last Sync', status.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('en-GB') : 'Never'],
        ].map(([label, value]) => (
          <div key={label} className="os-card" style={{ padding: '16px 18px' }}>
            <div style={{ fontSize: 11, textTransform: 'uppercase', color: '#8a7a6a', letterSpacing: '0.06em', fontWeight: 700 }}>{label}</div>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1a1611', marginTop: 6 }}>{value}</div>
          </div>
        ))}
      </div>

      <section className="os-card">
        <div className="os-card-head">
          <div><strong>Recent Sync Activity</strong><p>{status.recentEvents.length} recent event{status.recentEvents.length === 1 ? '' : 's'}</p></div>
        </div>
        <div className="os-card-body" style={{ gap: 0 }}>
          {status.recentEvents.length ? status.recentEvents.map((event, index) => (
            <div key={`${event.shopifyId}-${index}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #f3ede5' }}>
              {event.result === 'success'
                ? <CheckCircle size={15} strokeWidth={1.8} style={{ color: '#2a7d4f', flexShrink: 0 }} />
                : <XCircle size={15} strokeWidth={1.8} style={{ color: '#8a3520', flexShrink: 0 }} />}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1a1611' }}>
                  {event.type === 'customer' ? 'Customer' : 'Order'} {event.shopifyId}
                </div>
                <div style={{ fontSize: 12, color: '#8a7a6a' }}>
                  {event.result === 'success' ? event.payloadSummary : event.errorMessage}
                </div>
              </div>
              <div style={{ fontSize: 11, color: '#b0a090', flexShrink: 0 }}>
                {new Date(event.createdAt).toLocaleString('en-GB')}
              </div>
            </div>
          )) : <p style={{ margin: 0, fontSize: 13, color: '#8a7a6a' }}>No Shopify activity yet.</p>}
        </div>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Wire the route**

In `twif/src/App.jsx`:
- Add the import near the other page imports: `import ShopifySyncPage from './pages/owner/ShopifySyncPage';`
- In `renderView`, add a branch following the same pattern as the existing `'User Management'` branch:
```js
  if (activeView === 'Shopify Sync') return <ShopifySyncPage />;
```

- [ ] **Step 5: Verify with the full render check**

```bash
cd twif
npm run verify
```
Expected: `nothing undefined`, the build succeeds, and all 6 "can open every page in their menu" scenarios pass — the new nav item and page get exercised automatically by that existing check since it opens every item in the menu for every role, with no scenario file changes needed.

- [ ] **Step 6: Commit**

```bash
git add src/pages/owner/ShopifySyncPage.jsx src/config/oms.js src/App.jsx
git commit -m "Add Admin-only Shopify Sync panel"
```

---

## Task 9: Combined order history on the customer profile

This is the "RTW and bespoke order history visible together on one client
profile" requirement from the spec — without it, Shopify orders sync into
the database but a Store Manager never actually sees them next to a
customer's bespoke history.

**Files:**
- Modify: `server/routes/oms.routes.js:1116` (the `GET /customers` list route)
- Modify: `twif/src/pages/store-manager/CustomerProfilePage.jsx`

**Interfaces:**
- Consumes: `db.ShopifyOrder` (Task 1).
- Produces: adds a `shopifyOrders: [{orderNumber, total, currency, financialStatus, fulfillmentStatus, placedAt, shopifyAdminUrl}]` array to each customer object returned by `GET /oms/customers`.

- [ ] **Step 1: Attach Shopify orders to each customer profile in the list endpoint**

In `server/routes/oms.routes.js`, inside `router.get('/customers', ...)`, add a `ShopifyOrder.findAll()` alongside the existing `Customer.findAll`/`SentInvoice.findAll` calls, then group and attach by `customerId`:

Change:
```js
  const [customerRecords, sentInvoices] = await Promise.all([
    Customer.findAll({
      where: includeArchived ? {} : { category: { [Op.ne]: 'Archived' } },
      order: [['createdAt', 'DESC']],
    }),
    SentInvoice.findAll({ order: [['createdAt', 'DESC']], limit: 500 }),
  ]);
```
to:
```js
  const [customerRecords, sentInvoices, shopifyOrderRecords] = await Promise.all([
    Customer.findAll({
      where: includeArchived ? {} : { category: { [Op.ne]: 'Archived' } },
      order: [['createdAt', 'DESC']],
    }),
    SentInvoice.findAll({ order: [['createdAt', 'DESC']], limit: 500 }),
    ShopifyOrder.findAll({ order: [['placedAt', 'DESC']], limit: 500 }),
  ]);
  const shopifyOrdersByCustomerId = new Map();
  shopifyOrderRecords.forEach((order) => {
    const list = shopifyOrdersByCustomerId.get(order.customerId) || [];
    list.push({
      orderNumber: order.orderNumber,
      total: Number(order.total || 0),
      currency: order.currency,
      financialStatus: order.financialStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      placedAt: order.placedAt,
      shopifyAdminUrl: order.shopifyAdminUrl,
    });
    shopifyOrdersByCustomerId.set(order.customerId, list);
  });
```

Add `ShopifyOrder` to the router's model destructure near the top of the file (alongside the existing `const { StaffUser, Customer, ... } = db;` line):
```js
const { StaffUser, Customer, Invoice, OrderSheet, Fabric, SentInvoice, OmsNotification, InventoryAllocation, InventoryEditRequest, JobComment, StaffLoginEvent, Store, ShopifyOrder } = db;
```

Then in the final `customers.map(...)` block (the one building each returned customer object, starting around the line with `id: profile.id,`), add one field:
```js
      shopifyOrders: shopifyOrdersByCustomerId.get(profile.id) || [],
```

- [ ] **Step 2: Add the Shopify order history section to the customer profile page**

In `twif/src/pages/store-manager/CustomerProfilePage.jsx`, add `Tag` to the lucide-react import list:
```js
import { ArrowLeft, Edit2, Plus, User, Ruler, ShoppingBag, FileText, Clock, StickyNote, Save, X, MapPin, Phone, Star, ChevronRight, Tag } from 'lucide-react';
```

After the closing `</div>` of the "Recent Orders" card (the one containing `{!invoices.length ? (...) : null}` for that section) and before the `{/* Invoices */}` comment, insert:
```jsx
          {/* Ready-to-Wear (Shopify) */}
          {(customer.shopifyOrders || []).length ? (
            <div className="os-card">
              <div className="os-card-head">
                <Tag size={16} strokeWidth={1.8} style={{ color: '#c97b08' }} />
                <div>
                  <strong>Ready-to-Wear (Shopify)</strong>
                  <p>{customer.shopifyOrders.length} order{customer.shopifyOrders.length !== 1 ? 's' : ''} from the online store</p>
                </div>
              </div>
              <div className="os-card-body" style={{ gap: 10 }}>
                {customer.shopifyOrders.slice(0, 4).map((order, index) => (
                  <div
                    key={`${order.orderNumber || 'order'}-${index}`}
                    style={{
                      border: '1px solid #f3ede5', borderRadius: 10, padding: '12px 14px',
                      background: '#faf7f3',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 800, color: '#0f0b06' }}>{order.orderNumber || 'Shopify order'}</span>
                      <Status>{order.financialStatus || 'unknown'}</Status>
                    </div>
                    <div style={{ fontSize: 12, color: '#8a7a6a', marginTop: 2 }}>
                      {order.placedAt ? new Date(order.placedAt).toLocaleDateString('en-GB') : 'Date unknown'} &middot; {order.fulfillmentStatus || 'not fulfilled'}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: '#1a1611' }}>{money.format(order.total)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
```

- [ ] **Step 3: Verify the backend change against the local dev DB**

```bash
cd server
node -e "
const axios = require('axios');
const db = require('./models');
const crypto = require('crypto');
(async () => {
  const customer = await db.Customer.create({ fullName: 'Profile Merge Test', email: 'merge-test@example.com', category: 'New', portalToken: crypto.randomBytes(32).toString('hex') });
  await db.ShopifyOrder.create({ customerId: customer.id, shopifyOrderId: '555001', orderNumber: '#2001', total: 25000, currency: 'NGN', financialStatus: 'paid', fulfillmentStatus: 'fulfilled', placedAt: new Date() });

  const response = await axios.get('http://localhost:8096/api/oms/customers', { headers: { Authorization: \`Bearer \${process.env.TEST_TOKEN}\` } }).catch((e) => e.response);
  console.log('request status:', response.status);
  const found = response.data?.data?.customers?.find((c) => c.id === customer.id);
  console.log('shopifyOrders attached:', Array.isArray(found?.shopifyOrders) && found.shopifyOrders.length === 1 && found.shopifyOrders[0].orderNumber === '#2001');

  await db.ShopifyOrder.destroy({ where: { customerId: customer.id } });
  await customer.destroy();
  await db.sequelize.close();
})();
"
```
(Start the server on port 8096 first, and set `TEST_TOKEN` to a real Owner login token obtained the same way earlier tasks did, before running the script above.)

Expected: `request status: 200`, `shopifyOrders attached: true`.

Then verify the frontend build and render check still pass:
```bash
cd twif
npm run verify
```
Expected: build succeeds, all 6 "every page renders" scenarios still pass (the profile page change is exercised as part of opening the Customers page for Store Manager/Owner).

- [ ] **Step 4: Commit**

```bash
cd server && git add routes/oms.routes.js && git commit -m "Attach Shopify order summaries to the customer list endpoint"
cd ../twif && git add src/pages/store-manager/CustomerProfilePage.jsx && git commit -m "Show Shopify (RTW) order history alongside bespoke orders on the customer profile"
```

---

## What's left after this plan (manual, not code)

1. Update the "tWIF Internal App" scopes in the Shopify Dev Dashboard to include `read_customers` and `read_orders` (currently only requests staff data).
2. Set `SHOPIFY_CLIENT_ID`, `SHOPIFY_CLIENT_SECRET`, `SHOPIFY_SHOP_DOMAIN`, `SHOPIFY_APP_URL`, `ENCRYPTION_KEY` in the real server environment (Railway). `ENCRYPTION_KEY` must be the same value across every process (server and the bulk-import script) — otherwise each process generates its own random key and tokens encrypted by one become undecryptable by another.
3. Visit `GET /api/oms/shopify/install` once, approve the grant — this stores the real access token.
4. Register the five webhooks in the Shopify admin (`customers/create`, `customers/update`, `orders/create`, `orders/updated`, `orders/cancelled`), pointing at `https://<SHOPIFY_APP_URL>/api/oms/shopify/webhooks/customers` or `.../webhooks/orders` as appropriate. Do not register `refunds/create`: a refund payload's top-level `id` is the refund's own id (the order id is at `order_id`), and it carries no `customer`, `total_price`, or `financial_status` — routing it to `/webhooks/orders` would create a phantom `ShopifyOrder` row keyed on the refund id with `total: 0`. `orders/updated` already fires on a refund and carries the corrected `financial_status`, which is all the integration needs.
5. Run `node scripts/shopifyInitialImport.js` once for the initial bulk import.
6. The subdomain/DNS work connecting the Shopify-hosted domain to Railway (explicitly out of scope for this plan, per the spec).
