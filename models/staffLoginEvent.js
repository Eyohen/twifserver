'use strict';

// The Login History screen used to draw seven rows out of the row index —
// invented IP addresses, invented devices, dates in 2024. An owner looking into
// a security concern was reading fiction. Every sign-in attempt is recorded
// here instead, including the ones that failed.
module.exports = (sequelize, DataTypes) => sequelize.define('StaffLoginEvent', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  // Null when nobody owns the number that was tried, which is itself worth
  // seeing: it means someone is guessing.
  staffUserId: { type: DataTypes.UUID, allowNull: true },
  phone: { type: DataTypes.STRING(32), allowNull: false },
  outcome: {
    type: DataTypes.ENUM('success', 'wrong_credentials', 'inactive_account'),
    allowNull: false,
  },
  ipAddress: { type: DataTypes.STRING(64), allowNull: true },
  userAgent: { type: DataTypes.STRING(400), allowNull: true },
}, {
  tableName: 'StaffLoginEvents',
  timestamps: true,
  indexes: [
    { fields: ['staffUserId', 'createdAt'] },
    { fields: ['phone', 'createdAt'] },
  ],
});
