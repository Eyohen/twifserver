'use strict';

module.exports = (sequelize, DataTypes) => sequelize.define('OmsNotification', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  recipientRole: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  channel: {
    type: DataTypes.STRING(60),
    allowNull: false,
    defaultValue: 'Inventory',
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  metadata: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  isRead: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
}, {
  tableName: 'OmsNotifications',
  timestamps: true,
  indexes: [
    { fields: ['recipientRole', 'createdAt'] },
  ],
});
