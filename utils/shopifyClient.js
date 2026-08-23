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

const isValidShopDomain = (shop) => /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(String(shop || '').toLowerCase());

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
  if (!isValidShopDomain(shop)) throw new Error(`"${shop}" is not a valid Shopify shop domain.`);
  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    state,
  });
  return `https://${shop}/admin/oauth/authorize?${params.toString()}`;
};

const exchangeCodeForToken = async ({ shop, clientId, clientSecret, code }) => {
  if (!isValidShopDomain(shop)) throw new Error(`"${shop}" is not a valid Shopify shop domain.`);
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
  if (!isValidShopDomain(shop)) throw new Error(`"${shop}" is not a valid Shopify shop domain.`);
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
  isValidShopDomain,
  verifyWebhookHmac,
  verifyOAuthHmac,
  buildAuthorizeUrl,
  exchangeCodeForToken,
  fetchCustomersPage,
};
