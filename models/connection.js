'use strict';

module.exports = (sequelize, DataTypes) => {
  const Connection = sequelize.define('Connection', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    requesterId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    recipientId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    status: {
      type: DataTypes.ENUM('pending', 'connected', 'declined'),
      allowNull: false,
      defaultValue: 'pending'
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'Connections',
    timestamps: true,
    indexes: [
      { fields: ['requesterId'] },
      { fields: ['recipientId'] },
      { fields: ['status'] },
      { fields: ['requesterId', 'recipientId'], unique: true }
    ]
  });

  Connection.associate = function(models) {
    Connection.belongsTo(models.User, {
      foreignKey: 'requesterId',
      as: 'requester'
    });
    Connection.belongsTo(models.User, {
      foreignKey: 'recipientId',
      as: 'recipient'
    });
  };

  return Connection;
};
