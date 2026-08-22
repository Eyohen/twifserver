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
    // A Store.key — see the note on Invoice.store for why this is a plain
    // string rather than a foreign key.
    store: {
      type: DataTypes.STRING(40),
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
    // Who raised it, as an id rather than a name. A display name is not unique
    // and was taken from the request body, so "the person who raised this" was
    // a claim anyone could make and anyone sharing that name could satisfy.
    createdByStaffId: {
      type: DataTypes.UUID,
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
      type: DataTypes.ENUM('unpaid', 'partial_paid', 'fully_paid'),
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
