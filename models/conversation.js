'use strict';

module.exports = (sequelize, DataTypes) => {
  const Conversation = sequelize.define('Conversation', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'CollaborationRequests',
        key: 'id'
      }
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
    lastMessageAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    lastMessagePreview: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    brandUnreadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    creatorUnreadCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    brandArchivedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    creatorArchivedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    // Papersignal integration - stores the external room ID
    papersignalRoomId: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true
    }
  }, {
    tableName: 'Conversations',
    timestamps: true,
    indexes: [
      { fields: ['brandId'] },
      { fields: ['creatorId'] },
      { fields: ['requestId'] },
      { fields: ['lastMessageAt'] },
      { fields: ['brandId', 'creatorId'], unique: true, name: 'unique_brand_creator' }
    ]
  });

  Conversation.associate = function(models) {
    Conversation.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand'
    });
    Conversation.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
    Conversation.belongsTo(models.CollaborationRequest, {
      foreignKey: 'requestId',
      as: 'request'
    });
    Conversation.hasMany(models.Message, {
      foreignKey: 'conversationId',
      as: 'messages'
    });
  };

  return Conversation;
};
