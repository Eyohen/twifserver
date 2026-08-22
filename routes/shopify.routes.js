'use strict';

const express = require('express');
const crypto = require('crypto');
const db = require('../models');
const Encryption = require('../utils/encryption');
const { requireStaff, requireRole } = require('../middleware/staffAuth');
const {
  verifyOAuthHmac,
  verifyWebhookHmac,
  buildAuthorizeUrl,
  exchangeCodeForToken,
} = require('../utils/shopifyClient');
const {
  findOrCreateCustomerFromShopify,
  upsertShopifyOrderFromShopify,
  recordSyncEvent,
} = require('../services/shopifySync.service');

const router = express.Router();
const { ShopifyStore, ShopifySyncEvent, Customer, ShopifyOrder } = db;

const SCOPES = 'read_customers,read_orders';

const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

router.get('/install', (req, res) => {
  const shop = process.env.SHOPIFY_SHOP_DOMAIN;
  const appUrl = process.env.SHOPIFY_APP_URL;
  const clientId = process.env.SHOPIFY_CLIENT_ID;

  if (!shop || !appUrl || !clientId || !process.env.ENCRYPTION_KEY) {
    return res.status(500).json({
      success: false,
      message: 'SHOPIFY_SHOP_DOMAIN, SHOPIFY_APP_URL, SHOPIFY_CLIENT_ID and ENCRYPTION_KEY must be set to install.',
    });
  }

  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('shopify_oauth_state', state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    maxAge: 5 * 60 * 1000,
  });

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
  if (req.query.shop !== process.env.SHOPIFY_SHOP_DOMAIN) {
    return res.status(403).json({ success: false, message: 'This app can only be installed on the configured shop.' });
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
    // Both the ShopifySyncEvent columns above are STRING(500) — an
    // unusually long error message would otherwise throw here too and
    // escape as an unlogged 500, the opposite of this fallback's intent.
    try {
      await recordSyncEvent({
        type: 'customer',
        shopifyId: payload?.id != null ? String(payload.id) : null,
        dedupeKey: req.shopifyDedupeKey,
        result: 'error',
        errorMessage: String(error.message).slice(0, 500),
      });
    } catch (loggingError) {
      console.error('Failed to record Shopify customer sync error event:', loggingError);
    }
    // Shopify never retries a 200. The upserts and recordSyncEvent's
    // dedupeKey handling are idempotent, so a retry (reusing the same
    // X-Shopify-Webhook-Id) is safe — a 500 here is what makes Shopify
    // retry a transient failure instead of silently losing the sync.
    return res.status(500).send('error');
  }
  res.status(200).send('ok');
}));

router.post('/webhooks/orders', requireWebhookSignature, asyncHandler(async (req, res) => {
  const payload = req.body;
  if (!payload.customer?.id) {
    // Guest checkouts and many POS orders carry customer: null. Falling
    // through to findOrCreateCustomerFromShopify would synthesize a
    // shopifyCustomerId of the literal string "undefined", merging every
    // guest order onto one shared phantom customer.
    await recordSyncEvent({
      type: 'order',
      shopifyId: payload.id != null ? String(payload.id) : null,
      dedupeKey: req.shopifyDedupeKey,
      result: 'skipped',
      payloadSummary: 'Guest/POS order with no linked Shopify customer — skipped',
    });
    return res.status(200).send('ok');
  }
  try {
    const customer = await findOrCreateCustomerFromShopify(payload.customer);
    const order = await upsertShopifyOrderFromShopify(payload, customer.id);
    await recordSyncEvent({
      type: 'order',
      shopifyId: payload.id != null ? String(payload.id) : null,
      dedupeKey: req.shopifyDedupeKey,
      result: 'success',
      payloadSummary: `Order ${order.orderNumber || order.shopifyOrderId} — ${order.financialStatus || 'unknown status'}`,
    });
  } catch (error) {
    try {
      await recordSyncEvent({
        type: 'order',
        shopifyId: payload?.id != null ? String(payload.id) : null,
        dedupeKey: req.shopifyDedupeKey,
        result: 'error',
        errorMessage: String(error.message).slice(0, 500),
      });
    } catch (loggingError) {
      console.error('Failed to record Shopify order sync error event:', loggingError);
    }
    return res.status(500).send('error');
  }
  res.status(200).send('ok');
}));

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

module.exports = router;
