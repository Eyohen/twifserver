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
