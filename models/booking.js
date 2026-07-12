'use strict';

module.exports = (sequelize, DataTypes) => {
  const Booking = sequelize.define('Booking', {
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
    scheduledFor: {
      type: DataTypes.DATE,
      allowNull: true
    },
    slotDate: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    slotDay: {
      type: DataTypes.STRING(40),
      allowNull: true
    },
    slotTime: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    durationMinutes: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 30
    },
    agenda: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    attachmentName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    status: {
      type: DataTypes.ENUM('pending', 'accepted', 'declined', 'cancelled'),
      allowNull: false,
      defaultValue: 'pending'
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    cancelledAt: {
      type: DataTypes.DATE,
      allowNull: true
    }
  }, {
    tableName: 'Bookings',
    timestamps: true,
    indexes: [
      { fields: ['requesterId'] },
      { fields: ['recipientId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ]
  });

  Booking.associate = function(models) {
    Booking.belongsTo(models.User, {
      foreignKey: 'requesterId',
      as: 'requester'
    });
    Booking.belongsTo(models.User, {
      foreignKey: 'recipientId',
      as: 'recipient'
    });
  };

  return Booking;
};
