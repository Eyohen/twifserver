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
    // Uniqueness is enforced at the application layer (POST/PATCH /customers,
    // excluding archived customers so a freed-up number can be reused) —
    // NOT here. A DB-level unique constraint can't tell an active customer
    // from an archived one and would reject that reuse outright regardless
    // of what the app allows.
    phone: {
      type: DataTypes.STRING(32),
      allowNull: true,
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
      unique: true,
    },
  }, {
    tableName: 'Customers',
    timestamps: true,
  });

  Customer.associate = function(models) {
    Customer.hasMany(models.Invoice, { foreignKey: 'customerId', as: 'invoices' });
    Customer.hasMany(models.ShopifyOrder, { foreignKey: 'customerId', as: 'shopifyOrders' });
  };

  return Customer;
};
