'use strict';

module.exports = (sequelize, DataTypes) => {
  const Category = sequelize.define('Category', {
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
    parentId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Categories',
        key: 'id'
      }
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'Categories',
    timestamps: true,
    indexes: [
      { fields: ['slug'], unique: true },
      { fields: ['parentId'] },
      { fields: ['isActive'] }
    ]
  });

  Category.associate = function(models) {
    Category.belongsTo(models.Category, {
      foreignKey: 'parentId',
      as: 'parent'
    });
    Category.hasMany(models.Category, {
      foreignKey: 'parentId',
      as: 'subcategories'
    });
    Category.hasMany(models.Creator, {
      foreignKey: 'primaryNicheId',
      as: 'creators'
    });
  };

  return Category;
};
