'use strict';

module.exports = (sequelize, DataTypes) => {
  const Fabric = sequelize.define('Fabric', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // The stock code the team writes on the shelf label. Two items can share a
    // name — "Cotton, white" in two weights — so the SKU is what identifies one.
    sku: {
      type: DataTypes.STRING(48),
      allowNull: true,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(160),
      allowNull: false,
      unique: true,
    },
    // The inventory type: Fabric, Linings, Buttons and so on. Kept as free text
    // because the list is configurable rather than fixed in the schema.
    type: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    colour: {
      type: DataTypes.STRING(60),
      allowNull: true,
    },
    // What a single unit cost to buy, for valuing what is on the shelf.
    cost: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },
    // Where it physically sits — "Lekki store, rack 3" — so it can be found.
    location: {
      type: DataTypes.STRING(160),
      allowNull: true,
    },
    // A photo of the item, held as a data URL like the other uploads in this
    // system, so no file storage has to be provisioned for it.
    image: {
      type: DataTypes.TEXT,
      allowNull: true,
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
