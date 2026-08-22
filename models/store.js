'use strict';

module.exports = (sequelize, DataTypes) => {
  const Store = sequelize.define('Store', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // What Invoices.store and StaffUsers.store actually hold — lowercase,
    // stable once a store has orders or staff attached to it.
    key: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    location: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    manager: {
      type: DataTypes.STRING(120),
      allowNull: true,
    },
    // The letterhead lines an invoice PDF prints under the store name.
    addressLines: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    phone: {
      type: DataTypes.STRING(40),
      allowNull: true,
    },
    email: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      allowNull: false,
      defaultValue: 'active',
    },
  }, {
    tableName: 'Stores',
    timestamps: true,
  });

  return Store;
};
