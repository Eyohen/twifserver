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
    displayName: {
      type: DataTypes.STRING(120),
      allowNull: false,
    },
    role: {
      type: DataTypes.ENUM('owner', 'admin', 'store_manager', 'accounts', 'production_manager', 'inventory_manager', 'tailor'),
      allowNull: false,
    },
    store: {
      type: DataTypes.ENUM('ikeja', 'lekki', 'all', 'production'),
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
