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
