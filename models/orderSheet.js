'use strict';

module.exports = (sequelize, DataTypes) => {
  const OrderSheet = sequelize.define('OrderSheet', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    items: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    pieces: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    deliveryDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    measurementsSnapshot: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    fabricSource: {
      type: DataTypes.ENUM('inventory', 'client_supplied'),
      allowNull: false,
      defaultValue: 'inventory',
    },
    fabricName: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    styleImages: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    designNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    styleNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    productionStyleNote: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('draft', 'pending_payment', 'work_in_progress', 'ready', 'collected', 'cancelled'),
      allowNull: false,
      defaultValue: 'draft',
    },
    coreLockedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'OrderSheets',
    timestamps: true,
  });

  OrderSheet.associate = function(models) {
    OrderSheet.belongsTo(models.Invoice, { foreignKey: 'invoiceId', as: 'invoice' });
    OrderSheet.belongsTo(models.StaffUser, { foreignKey: 'assignedTailorId', as: 'assignedTailor' });
  };

  return OrderSheet;
};
