'use strict';

module.exports = (sequelize, DataTypes) => {
  const AvailabilitySlot = sequelize.define('AvailabilitySlot', {
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
    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    isAvailable: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    reason: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    slotType: {
      type: DataTypes.ENUM('blocked', 'booked', 'tentative'),
      defaultValue: 'blocked'
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'CollaborationRequests',
        key: 'id'
      }
    }
  }, {
    tableName: 'AvailabilitySlots',
    timestamps: true,
    indexes: [
      { fields: ['creatorId'] },
      { fields: ['startDate', 'endDate'] },
      { fields: ['isAvailable'] }
    ]
  });

  AvailabilitySlot.associate = function(models) {
    AvailabilitySlot.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
    AvailabilitySlot.belongsTo(models.CollaborationRequest, {
      foreignKey: 'requestId',
      as: 'request'
    });
  };

  return AvailabilitySlot;
};
