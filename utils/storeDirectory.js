'use strict';

const db = require('../models');

// Populated at server startup and refreshed by the store CRUD routes after
// every create/update/delete, so the two stay in step without every read
// having to hit the database.
let cache = new Map();

const refreshStoreCache = async () => {
  const stores = await db.Store.findAll({ order: [['createdAt', 'ASC']] });
  cache = new Map(stores.map((store) => [store.key, store.get({ plain: true })]));
  return cache;
};

const normalizeStoreKey = (store) => {
  const key = String(store || '').trim().toLowerCase();
  if (cache.has(key)) return key;
  return key;
};

// Synchronous by design: invoice PDFs and plain-text summaries are built from
// this outside of any request's async chain, so it reads the in-memory cache
// rather than the database directly.
const getTwifStoreDetails = (store) => {
  const key = normalizeStoreKey(store);
  const record = cache.get(key);
  if (record) {
    return {
      key: record.key,
      label: record.name,
      addressLines: record.addressLines || [],
      phone: record.phone || '',
      email: record.email || '',
    };
  }
  // The cache has not loaded yet, or the key is genuinely unknown — a label
  // beats a crash while an invoice is being built.
  return {
    key,
    label: `${key.charAt(0).toUpperCase()}${key.slice(1)} Store`,
    addressLines: [],
    phone: '',
    email: '',
  };
};

const listStores = ({ activeOnly = false } = {}) => [...cache.values()]
  .filter((store) => !activeOnly || store.status === 'active');

const storeKeys = ({ activeOnly = false } = {}) => listStores({ activeOnly }).map((store) => store.key);

module.exports = {
  refreshStoreCache,
  getTwifStoreDetails,
  listStores,
  storeKeys,
  normalizeStoreKey,
};
