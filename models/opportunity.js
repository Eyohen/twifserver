'use strict';

module.exports = (sequelize, DataTypes) => {
  const Opportunity = sequelize.define('Opportunity', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    ownerId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    category: {
      type: DataTypes.ENUM('Partnerships', 'Contracts', 'Joint Ventures', 'Vendor Sourcing', 'Investment', 'Jobs'),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    budget: {
      type: DataTypes.STRING(120),
      allowNull: true
    },
    location: {
      type: DataTypes.STRING(150),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('active', 'closed'),
      allowNull: false,
      defaultValue: 'active'
    }
  }, {
    tableName: 'Opportunities',
    timestamps: true,
    indexes: [
      { fields: ['ownerId'] },
      { fields: ['category'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ]
  });

  Opportunity.associate = function(models) {
    Opportunity.belongsTo(models.User, {
      foreignKey: 'ownerId',
      as: 'owner'
    });
    Opportunity.hasMany(models.OpportunityInterest, {
      foreignKey: 'opportunityId',
      as: 'interests'
    });
  };

  return Opportunity;
};
