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
