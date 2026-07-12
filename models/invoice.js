'use strict';

module.exports = (sequelize, DataTypes) => {
  const Invoice = sequelize.define('Invoice', {
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
      type: DataTypes.ENUM('ikeja', 'lekki'),
      allowNull: false,
    },
    subtotal: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    discountAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    storeCreditApplied: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },
    paymentStatus: {
      type: DataTypes.ENUM('unpaid', 'partial_paid', 'paid', 'pending_confirmation', 'confirmed', 'flagged'),
      allowNull: false,
      defaultValue: 'unpaid',
    },
    pdfUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
  }, {
    tableName: 'Invoices',
    timestamps: true,
  });

  Invoice.associate = function(models) {
    Invoice.belongsTo(models.Customer, { foreignKey: 'customerId', as: 'customer' });
    Invoice.belongsTo(models.StaffUser, { foreignKey: 'createdById', as: 'createdBy' });
    Invoice.hasOne(models.OrderSheet, { foreignKey: 'invoiceId', as: 'orderSheet' });
  };

  return Invoice;
};
