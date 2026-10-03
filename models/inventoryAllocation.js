'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('InventoryAllocation', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  fabricId: { type: DataTypes.UUID, allowNull: false },
  fabricName: { type: DataTypes.STRING(160), allowNull: false },
  quantity: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
  unit: { type: DataTypes.STRING(24), allowNull: false },
  invoiceNumber: { type: DataTypes.STRING(40), allowNull: false },
  customerName: { type: DataTypes.STRING(160), allowNull: false },
  tailorName: { type: DataTypes.STRING(120), allowNull: false },
  trackingToken: { type: DataTypes.STRING(128), allowNull: false, unique: true },
  // Which garment on the order this was taken for — null for an allocation
  // made before fabric was tracked per item, or for a legacy single-item
  // sheet with no real items array.
  itemIndex: { type: DataTypes.INTEGER, allowNull: true },
  itemName: { type: DataTypes.STRING(160), allowNull: true },
}, {
  tableName: 'InventoryAllocations',
  timestamps: true,
  indexes: [
    { fields: ['fabricId', 'createdAt'] },
    { fields: ['invoiceNumber'] },
  ],
});
