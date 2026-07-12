'use strict';

module.exports = (sequelize, DataTypes) => {
  const Fabric = sequelize.define('Fabric', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
    },
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    quantity: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
    unit: {
      type: DataTypes.STRING(24),
      allowNull: false,
      defaultValue: 'm',
    },
    supplier: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    lowStockThreshold: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0,
    },
  }, {
    tableName: 'Fabrics',
    timestamps: true,
  });

  return Fabric;
};
