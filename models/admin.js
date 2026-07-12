'use strict';

module.exports = (sequelize, DataTypes) => {
  const Admin = sequelize.define('Admin', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
      validate: {
        isEmail: true
      }
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    lastName: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM('super_admin', 'admin', 'moderator', 'support'),
      defaultValue: 'admin'
    },
    permissions: {
      type: DataTypes.JSONB,
      defaultValue: {
        users: { read: true, write: false, delete: false },
        creators: { read: true, write: true, delete: false, verify: true },
        brands: { read: true, write: true, delete: false },
        requests: { read: true, write: true, delete: false, resolve: true },
        payments: { read: true, write: false, refund: false },
        settings: { read: true, write: false },
        reports: { read: true, export: true }
      }
    },
    status: {
      type: DataTypes.ENUM('active', 'inactive'),
      defaultValue: 'active'
    },
    lastLoginAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    refreshToken: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'Admins',
    timestamps: true
  });

  Admin.associate = function(models) {
    Admin.hasMany(models.AuditLog, {
      foreignKey: 'adminId',
      as: 'auditLogs'
    });
  };

  return Admin;
};
