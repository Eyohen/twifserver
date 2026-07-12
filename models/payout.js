'use strict';

module.exports = (sequelize, DataTypes) => {
  const Payout = sequelize.define('Payout', {
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
    creatorId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Creators',
        key: 'id'
      }
    },
    bankAccountId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'BankAccounts',
        key: 'id'
      }
    },
    // Amount
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false
    },
    currency: {
      type: DataTypes.STRING(3),
      defaultValue: 'NGN'
    },
    // Paystack Transfer
    paystackTransferCode: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    paystackRecipientCode: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    paystackTransferId: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    // Status
    status: {
      type: DataTypes.ENUM('pending', 'processing', 'completed', 'failed', 'reversed'),
      defaultValue: 'pending'
    },
    // Processing
    processedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    failureReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // Bank Details (snapshot at time of payout)
    bankName: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    accountNumber: {
      type: DataTypes.STRING(20),
      allowNull: true
    },
    accountName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    // Metadata
    metadata: {
      type: DataTypes.JSONB,
      defaultValue: {}
    }
  }, {
    tableName: 'Payouts',
    timestamps: true,
    indexes: [
      { fields: ['referenceNumber'], unique: true },
      { fields: ['creatorId'] },
      { fields: ['status'] },
      { fields: ['createdAt'] }
    ]
  });

  Payout.associate = function(models) {
    Payout.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
    Payout.belongsTo(models.BankAccount, {
      foreignKey: 'bankAccountId',
      as: 'bankAccount'
    });
  };

  // Generate payout reference
  Payout.generateReference = function() {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CW-PO-${timestamp}-${random}`;
  };

  return Payout;
};
