'use strict';

module.exports = (sequelize, DataTypes) => {
  const State = sequelize.define('State', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    regionId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Regions',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    code: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'States',
    timestamps: true,
    indexes: [
      { fields: ['regionId'] }
    ]
  });

  State.associate = function(models) {
    State.belongsTo(models.Region, {
      foreignKey: 'regionId',
      as: 'region'
    });
    State.hasMany(models.City, {
      foreignKey: 'stateId',
      as: 'cities'
    });
    State.hasMany(models.Creator, {
      foreignKey: 'stateId',
      as: 'creators'
    });
    State.hasMany(models.Brand, {
      foreignKey: 'stateId',
      as: 'brands'
    });
  };

  return State;
};
