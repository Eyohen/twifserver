'use strict';

module.exports = (sequelize, DataTypes) => {
  const LegalClause = sequelize.define('LegalClause', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Creators',
        key: 'id'
      }
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    clauseType: {
      type: DataTypes.ENUM('usage_rights', 'exclusivity', 'payment', 'termination', 'confidentiality', 'revision_policy', 'cancellation', 'custom'),
      allowNull: false
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    applyToAll: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    appliedServices: {
      type: DataTypes.ARRAY(DataTypes.UUID),
      defaultValue: []
    },
    displayOrder: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    }
  }, {
    tableName: 'LegalClauses',
    timestamps: true,
    indexes: [
      { fields: ['creatorId'] },
      { fields: ['clauseType'] },
      { fields: ['isActive'] }
    ]
  });

  LegalClause.associate = function(models) {
    LegalClause.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
  };

  return LegalClause;
};
