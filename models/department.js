'use strict';

module.exports = (sequelize, DataTypes) => {
  const Department = sequelize.define('Department', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    // What each order-sheet item's `department` field holds — lowercase,
    // stable once an item is tagged with it.
    key: {
      type: DataTypes.STRING(40),
      allowNull: false,
      unique: true,
    },
    name: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: 'active',
    },
  }, {
    tableName: 'Departments',
    timestamps: true,
  });

  return Department;
};
