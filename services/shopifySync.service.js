'use strict';

const crypto = require('crypto');
const db = require('../models');

const { Customer, ShopifyOrder, ShopifySyncEvent } = db;

// Shopify normalizes phone numbers to E.164 (+2348012345678); this OMS
// stores local format (08012345678). Comparing the last 10 digits matches
// across both formats without touching how phone is stored/displayed
// elsewhere in the app.
const last10Digits = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

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
  if (!customer && phone) {
    const targetPhone = last10Digits(phone);
    if (targetPhone) {
      const candidates = await Customer.findAll({ where: { phone: { [db.Sequelize.Op.ne]: null } } });
      customer = candidates.find((candidate) => last10Digits(candidate.phone) === targetPhone) || null;
    }
  }

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

    // A unique index (shopifyCustomerId or phone) collided with a row not
    // caught by the lookups above — a race let another concurrent webhook
    // create it first. Link to that existing customer instead of failing
    // the whole sync.
    const collided = (await Customer.findOne({ where: { shopifyCustomerId } }))
      || (phone ? await Customer.findOne({ where: { phone } }) : null);
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
// X-Shopify-Webhook-Id) throws a SequelizeUniqueConstraintError here, which
// is caught below and reported as { duplicate: true }. No caller currently
// branches on that value — the retried webhook still re-runs the idempotent
// upsert above it (safe, just not short-circuited), and only this second
// sync-event insert is silently absorbed by the unique constraint.
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
