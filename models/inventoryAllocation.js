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
}, {
  tableName: 'InventoryAllocations',
  timestamps: true,
  indexes: [
    { fields: ['fabricId', 'createdAt'] },
    { fields: ['invoiceNumber'] },
  ],
});
