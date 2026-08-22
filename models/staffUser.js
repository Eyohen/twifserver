'use strict';

module.exports = (sequelize, DataTypes) => {
  const StaffUser = sequelize.define('StaffUser', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    phone: {
      type: DataTypes.STRING(32),
      allowNull: false,
      unique: true,
    },
    pinHash: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    // Two-factor sign-in, which the Admin role requires. The secret is what an
    // authenticator app is set up with; it is never sent back to the browser
    // once enrolment is confirmed.
    twoFactorSecret: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    twoFactorEnabledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    // Hashed like a password, because a recovery code signs somebody in.
    twoFactorRecoveryCodes: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    displayName: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'store_manager', 'accounts', 'production_manager', 'inventory_manager', 'tailor'),
      allowNull: false,
    },
    // A Store.key, or one of the two non-store sentinels 'all' (every store)
    // and 'production' (not attached to a store at all) — so this stays a
    // plain string rather than a foreign key into Stores.
    store: {
      type: DataTypes.STRING(40),
      allowNull: false,
      defaultValue: 'all',
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive', 'deactivated'),
      allowNull: false,
      defaultValue: 'active',
    },
    profileImageUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    dateOfBirth: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    tailorDepartment: {
      type: DataTypes.ENUM('native', 'suit', 'trouser', 'finishing'),
      allowNull: true,
    },
    tailorGrade: {
      type: DataTypes.INTEGER,
      allowNull: true,
      validate: {
        min: 1,
        max: 5,
      },
    },
    googleAuthEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    googleAuthSecret: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },
    googleAuthVerifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    forceLogoutAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  }, {
    tableName: 'StaffUsers',
    timestamps: true,
  });

  StaffUser.associate = function(models) {
    StaffUser.hasMany(models.Invoice, { foreignKey: 'createdById', as: 'createdInvoices' });
    StaffUser.hasMany(models.OrderSheet, { foreignKey: 'assignedTailorId', as: 'tailorAssignments' });
  };

  return StaffUser;
};
