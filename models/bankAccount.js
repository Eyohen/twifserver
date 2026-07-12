'use strict';

module.exports = (sequelize, DataTypes) => {
  const BankAccount = sequelize.define('BankAccount', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    userId: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'Users',
        key: 'id'
      }
    },
    bankName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    bankCode: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    accountNumber: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    accountName: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    accountType: {
      type: DataTypes.ENUM('savings', 'current'),
      defaultValue: 'savings'
    },
    // Paystack Integration
    paystackRecipientCode: {
      type: DataTypes.STRING(100),
      allowNull: true
    },
    paystackBankId: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    // Verification
    isDefault: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    verified: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    }
  }, {
    tableName: 'BankAccounts',
    timestamps: true,
    indexes: [
      { fields: ['userId'] },
      { fields: ['accountNumber'] },
      { fields: ['isDefault'] }
    ]
  });

  BankAccount.associate = function(models) {
    BankAccount.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user'
    });
    BankAccount.hasMany(models.Payout, {
      foreignKey: 'bankAccountId',
      as: 'payouts'
    });
  };

  return BankAccount;
};
