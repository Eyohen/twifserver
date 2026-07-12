'use strict';

module.exports = (sequelize, DataTypes) => {
  const Customer = sequelize.define('Customer', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    fullName: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    phone: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
      validate: {
        isEmail: true,
      },
    },
    category: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'New',
    },
    storeCreditBalance: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    measurements: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    portalToken: {
      type: DataTypes.STRING(128),
      allowNull: false,
      unique: true,
    },
    portalLastVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    shopifyCustomerId: {
      type: DataTypes.STRING(128),
      allowNull: true,
    },
  }, {
    tableName: 'Customers',
    timestamps: true,
  });

  Customer.associate = function(models) {
    Customer.hasMany(models.Invoice, { foreignKey: 'customerId', as: 'invoices' });
  };

  return Customer;
};
