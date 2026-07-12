'use strict';

module.exports = (sequelize, DataTypes) => {
  const OpportunityInterest = sequelize.define('OpportunityInterest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    opportunityId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Opportunities',
        key: 'id'
      }
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    contactPreference: {
      type: DataTypes.ENUM('Email', 'Platform Message'),
      allowNull: false,
      defaultValue: 'Platform Message'
    },
    status: {
      type: DataTypes.ENUM('submitted', 'reviewed', 'accepted', 'declined'),
      allowNull: false,
      defaultValue: 'submitted'
    }
  }, {
    tableName: 'OpportunityInterests',
    timestamps: true,
    indexes: [
      { fields: ['opportunityId'] },
      { fields: ['userId'] },
      { fields: ['opportunityId', 'userId'], unique: true }
    ]
  });

  OpportunityInterest.associate = function(models) {
    OpportunityInterest.belongsTo(models.Opportunity, {
      foreignKey: 'opportunityId',
      as: 'opportunity'
    });
    OpportunityInterest.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
  };

  return OpportunityInterest;
};
