'use strict';

module.exports = (sequelize, DataTypes) => {
  const ContractTemplate = sequelize.define('ContractTemplate', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    variables: {
      type: DataTypes.JSONB,
      defaultValue: [
        'brand_name',
        'creator_name',
        'contract_number',
        'effective_date',
        'expiry_date',
        'deliverables',
        'total_amount',
        'platform_fee',
        'creator_payout',
        'payment_terms'
      ]
    },
    sections: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    version: {
      type: DataTypes.INTEGER,
      defaultValue: 1
    },
    createdBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Admins',
        key: 'id'
      }
    },
    updatedBy: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Admins',
        key: 'id'
      }
    }
  }, {
    tableName: 'ContractTemplates',
    timestamps: true,
    indexes: [
      { fields: ['isDefault'] },
      { fields: ['isActive'] }
    ]
  });

  ContractTemplate.associate = function(models) {
    ContractTemplate.hasMany(models.Contract, {
      foreignKey: 'templateId',
      as: 'contracts'
    });
  };

  return ContractTemplate;
};
