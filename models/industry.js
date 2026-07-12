'use strict';

module.exports = (sequelize, DataTypes) => {
  const Industry = sequelize.define('Industry', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    slug: {
      type: DataTypes.STRING(100),
      allowNull: false,
      unique: true
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    icon: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'Industries',
    timestamps: true,
    indexes: [
      { fields: ['slug'], unique: true },
      { fields: ['isActive'] }
    ]
  });

  Industry.associate = function(models) {
    Industry.hasMany(models.Brand, {
      foreignKey: 'industryId',
      as: 'brands'
    });
  };

  return Industry;
};
