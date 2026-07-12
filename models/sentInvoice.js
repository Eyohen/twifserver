'use strict';

module.exports = (sequelize, DataTypes) => {
  const SentInvoice = sequelize.define('SentInvoice', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    invoiceNumber: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    store: {
      type: DataTypes.ENUM('lekki', 'ikeja'),
      allowNull: false,
    },
    customerName: {
      type: DataTypes.STRING(160),
      allowNull: false,
    },
    customerEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    customerPhone: {
      type: DataTypes.STRING(32),
      allowNull: true,
    },
    createdByName: {
      type: DataTypes.STRING(120),
      allowNull: false,
      defaultValue: 'Store Manager',
    },
    total: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    paymentStatus: {
      type: DataTypes.ENUM('partial_paid', 'fully_paid'),
      allowNull: false,
      defaultValue: 'partial_paid',
    },
    emailStatus: {
      type: DataTypes.ENUM('sent', 'failed'),
      allowNull: false,
      defaultValue: 'sent',
    },
    orderStatus: {
      type: DataTypes.STRING(80),
      allowNull: false,
      defaultValue: 'Partial Paid',
    },
    messageId: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
  }, {
    tableName: 'SentInvoices',
    timestamps: true,
  });

  return SentInvoice;
};
