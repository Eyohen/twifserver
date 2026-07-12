'use strict';

module.exports = (sequelize, DataTypes) => {
  const CollaborationRequest = sequelize.define('CollaborationRequest', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    referenceNumber: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: true
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
    // Request Details
    title: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    objectives: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    deliverables: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: []
    },
    targetPlatforms: {
      type: DataTypes.ARRAY(DataTypes.STRING(50)),
      allowNull: false
    },
    contentRequirements: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    hashtags: {
      type: DataTypes.ARRAY(DataTypes.STRING(100)),
      defaultValue: []
    },
    mentions: {
      type: DataTypes.ARRAY(DataTypes.STRING(100)),
      defaultValue: []
    },
    dosAndDonts: {
      type: DataTypes.JSONB,
      defaultValue: { dos: [], donts: [] }
    },
    brandAssets: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    // Budget
    proposedBudget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    negotiatedBudget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    finalBudget: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'NGN'
    },
    // Timeline
    proposedStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    proposedEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    actualStartDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    actualEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    draftDeadline: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    deadlineFlexible: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    isRushDelivery: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    // Status
    status: {
      type: DataTypes.ENUM(
        'draft',
        'pending',
        'viewed',
        'negotiating',
        'accepted',
        'contract_pending',
        'contract_signed',
        'payment_pending',
        'in_progress',
        'content_submitted',
        'revision_requested',
        'completed',
        'cancelled',
        'declined',
        'disputed',
        'expired'
      ),
      defaultValue: 'draft'
    },
    // Notes & Reasons
    brandNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    creatorNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    declineReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    declineCategory: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    cancelReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    cancelledBy: {
      type: DataTypes.ENUM('brand', 'creator', 'admin'),
      allowNull: true
    },
    // Content Submission
    submittedContent: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    revisionCount: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    maxRevisions: {
      type: DataTypes.INTEGER,
      defaultValue: 2
    },
    revisionNotes: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Timestamps
    viewedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    respondedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    acceptedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    contentSubmittedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Negotiation
    negotiationRounds: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    maxNegotiationRounds: {
      type: DataTypes.INTEGER,
      defaultValue: 3
    }
  }, {
    tableName: 'CollaborationRequests',
    timestamps: true,
    indexes: [
      { fields: ['referenceNumber'], unique: true },
      { fields: ['brandId'] },
      { fields: ['creatorId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ]
  });

  CollaborationRequest.associate = function(models) {
    CollaborationRequest.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand'
    });
    CollaborationRequest.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
    CollaborationRequest.hasMany(models.RequestNegotiation, {
      foreignKey: 'requestId',
      as: 'negotiations'
    });
    CollaborationRequest.hasOne(models.Contract, {
      foreignKey: 'requestId',
      as: 'contract'
    });
    CollaborationRequest.hasMany(models.Payment, {
      foreignKey: 'requestId',
      as: 'payments'
    });
    CollaborationRequest.hasOne(models.Conversation, {
      foreignKey: 'requestId',
      as: 'conversation'
    });
    CollaborationRequest.hasMany(models.AvailabilitySlot, {
      foreignKey: 'requestId',
      as: 'availabilitySlots'
    });
  };

  // Generate reference number
  CollaborationRequest.generateReferenceNumber = function() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `CW-${timestamp}-${random}`;
  };

  return CollaborationRequest;
};
