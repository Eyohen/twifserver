'use strict';

module.exports = (sequelize, DataTypes) => {
  const SavedCreator = sequelize.define('SavedCreator', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    brandId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Brands',
        key: 'id'
      }
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Creators',
        key: 'id'
      }
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    tags: {
      type: DataTypes.ARRAY(DataTypes.STRING(50)),
      defaultValue: []
    }
  }, {
    tableName: 'SavedCreators',
    timestamps: true,
    indexes: [
      { fields: ['brandId'] },
      { fields: ['creatorId'] },
      { fields: ['brandId', 'creatorId'], unique: true }
    ]
  });

  SavedCreator.associate = function(models) {
    SavedCreator.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand'
    });
    SavedCreator.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
  };

  return SavedCreator;
};
