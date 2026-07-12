'use strict';

module.exports = (sequelize, DataTypes) => {
  const City = sequelize.define('City', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    stateId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'States',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'Cities',
    timestamps: true,
    indexes: [
      { fields: ['stateId'] }
    ]
  });

  City.associate = function(models) {
    City.belongsTo(models.State, {
      foreignKey: 'stateId',
      as: 'state'
    });
    City.hasMany(models.Creator, {
      foreignKey: 'cityId',
      as: 'creators'
    });
    City.hasMany(models.Brand, {
      foreignKey: 'cityId',
      as: 'brands'
    });
  };

  return City;
};
