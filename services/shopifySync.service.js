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

  try {
    return await Customer.create({
      fullName: shopifyFullName(shopifyCustomer),
      email,
      phone,
      shopifyCustomerId,
      category: 'New',
      portalToken: crypto.randomBytes(32).toString('hex'),
    });
  } catch (error) {
    if (error.name !== 'SequelizeUniqueConstraintError') throw error;

    // Phone unique index collided with a row not caught by the lookups
    // above (e.g. matched on phone alone, but a race let another request
    // create it first) — link to that existing customer instead of
    // failing the whole sync.
    const collided = phone ? await Customer.findOne({ where: { phone } }) : null;
    if (!collided) throw error;

    await collided.update({
      shopifyCustomerId,
      email: collided.email || email,
      phone: collided.phone || phone,
    });
    return collided;
  }
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
