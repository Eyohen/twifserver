'use strict';

module.exports = (sequelize, DataTypes) => {
  const Payment = sequelize.define('Payment', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    referenceNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'CollaborationRequests',
        key: 'id'
      }
    },
    contractId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'Contracts',
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
    // Payment Details
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    platformFee: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    platformFeePercentage: {
      type: DataTypes.DECIMAL(5, 4),
      allowNull: false
    },
    creatorPayout: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'NGN'
    },
    // Paystack Integration
    paystackReference: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    paystackAccessCode: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    paystackAuthorizationUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    },
    paystackTransactionId: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // Status
    status: {
      type: DataTypes.ENUM(
        'pending',
        'initialized',
        'escrow',
        'processing',
        'released',
        'completed',
        'refunded',
        'partially_refunded',
        'failed',
        'disputed',
        'cancelled'
      ),
      defaultValue: 'pending'
    },
    // Escrow
    escrowAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    escrowReleasedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    escrowReleasedBy: {
      type: DataTypes.UUID,
      allowNull: true
    },
    releaseType: {
      type: DataTypes.ENUM('automatic', 'manual', 'dispute_resolution'),
      allowNull: true
    },
    // Payment Method
    paymentMethod: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    paymentChannel: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    cardType: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    cardLast4: {
      type: DataTypes.STRING(4),
      allowNull: true
    },
    bankName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    },
    // Timestamps
    paidAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Refund
    refundedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      defaultValue: 0
    },
    refundReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    refundedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    // Failure
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    }
  }, {
    tableName: 'Payments',
    timestamps: true,
    indexes: [
      { fields: ['referenceNumber'], unique: true },
      { fields: ['requestId'] },
      { fields: ['brandId'] },
      { fields: ['creatorId'] },
      { fields: ['status'] },
      { fields: ['paystackReference'] }
    ]
  });

  Payment.associate = function(models) {
    Payment.belongsTo(models.CollaborationRequest, {
      foreignKey: 'requestId',
      as: 'request'
    });
    Payment.belongsTo(models.Contract, {
      foreignKey: 'contractId',
      as: 'contract'
    });
    Payment.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand'
    });
    Payment.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
  };

  // Generate payment reference
  Payment.generateReference = function() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CW-PAY-${timestamp}-${random}`;
  };

  return Payment;
};
