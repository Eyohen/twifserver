'use strict';

const db = require('../models');

// The two stores the shop opened with. A blank Stores table — first boot, or
// a database from before this table existed — gets them back automatically,
// the same way index.js repairs a missing table: nobody should have to run a
// script to see the stores that already exist.
const DEFAULT_STORES = [
  {
    key: 'lekki',
    name: 'Lekki Store',
    location: 'Lekki Phase One, Lagos',
    addressLines: [
      process.env.TWIF_LEKKI_ADDRESS_LINE_1 || 'Casa Kaysora Mall, Lekki Phase One, Lagos',
      process.env.TWIF_LEKKI_ADDRESS_LINE_2 || 'Pavilion Heights, Issac John Street, Ikeja GRA',
      process.env.TWIF_LEKKI_ADDRESS_LINE_3 || 'Opposite Radisson Hotel',
    ],
    phone: process.env.TWIF_LEKKI_PHONE || '+234 705 533 7410',
    email: process.env.TWIF_LEKKI_EMAIL || 'twifclothing@gmail.com',
  },
  {
    key: 'ikeja',
    name: 'Ikeja Store',
    location: 'Ikeja GRA, Lagos',
    addressLines: [
      process.env.TWIF_IKEJA_ADDRESS_LINE_1 || 'Pavilion Heights, Issac John Street, Ikeja GRA',
      process.env.TWIF_IKEJA_ADDRESS_LINE_2 || 'Ikeja, Lagos',
    ],
    phone: process.env.TWIF_IKEJA_PHONE || '+234 705 533 7410',
    email: process.env.TWIF_IKEJA_EMAIL || 'twifclothing@gmail.com',
  },
];

const FALLBACK_KEY = 'lekki';

// Populated at server startup and refreshed by the store CRUD routes after
// every create/update/delete, so the two stay in step without every read
// having to hit the database.
let cache = new Map(DEFAULT_STORES.map((store) => [store.key, { ...store, status: 'active' }]));

const ensureSeeded = async () => {
  const existing = await db.Store.count();
  if (existing > 0) return;
  await db.Store.bulkCreate(DEFAULT_STORES.map((store) => ({ ...store, status: 'active' })));
};

const refreshStoreCache = async () => {
  await ensureSeeded();
  const stores = await db.Store.findAll({ order: [['createdAt', 'ASC']] });
  cache = new Map(stores.map((store) => [store.key, store.get({ plain: true })]));
  return cache;
};

const normalizeStoreKey = (store) => {
  const key = String(store || FALLBACK_KEY).trim().toLowerCase();
  if (cache.has(key)) return key;
  return cache.has(FALLBACK_KEY) ? FALLBACK_KEY : key;
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
