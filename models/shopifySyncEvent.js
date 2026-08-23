'use strict';

// An audit log of every webhook the OMS has processed — what the Admin
// Sync panel reads from. dedupeKey is unique so a retried Shopify delivery
// (same X-Shopify-Webhook-Id) fails to insert a second event row here, but
// nothing currently reads that outcome to skip reprocessing — the retried
// webhook's upsert still re-runs (safe, since it's idempotent).
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
