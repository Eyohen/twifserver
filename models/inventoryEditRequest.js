'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('InventoryEditRequest', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  fabricId: { type: DataTypes.UUID, allowNull: false },
  requestedBy: { type: DataTypes.STRING(160), allowNull: false },
  requestedByRole: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'inventory_manager' },
  proposedChanges: { type: DataTypes.JSONB, allowNull: false, defaultValue: {} },
  reason: { type: DataTypes.TEXT, allowNull: false },
  status: { type: DataTypes.STRING(30), allowNull: false, defaultValue: 'Pending Owner Approval' },
  reviewedBy: { type: DataTypes.STRING(160), allowNull: true },
  reviewedAt: { type: DataTypes.DATE, allowNull: true },
  reviewNote: { type: DataTypes.TEXT, allowNull: true },
}, { tableName: 'InventoryEditRequests', timestamps: true, indexes: [{ fields: ['status', 'createdAt'] }, { fields: ['fabricId'] }] });
