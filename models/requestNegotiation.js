'use strict';

module.exports = (sequelize, DataTypes) => {
  const RequestNegotiation = sequelize.define('RequestNegotiation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'CollaborationRequests',
        key: 'id'
      }
    },
    initiatedBy: {
      type: DataTypes.ENUM('brand', 'creator'),
      allowNull: false
    },
    roundNumber: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    // Proposed Changes
    proposedBudget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    proposedStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    proposedEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    proposedDeliverables: {
      type: DataTypes.JSONB,
      allowNull: true
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Response
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'countered', 'declined'),
      defaultValue: 'pending'
    },
    responseMessage: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'RequestNegotiations',
    timestamps: true,
    indexes: [
      { fields: ['requestId'] },
      { fields: ['status'] }
    ]
  });

  RequestNegotiation.associate = function(models) {
    RequestNegotiation.belongsTo(models.CollaborationRequest, {
      foreignKey: 'requestId',
      as: 'request'
    });
  };

  return RequestNegotiation;
};
