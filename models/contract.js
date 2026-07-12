'use strict';

module.exports = (sequelize, DataTypes) => {
  const Contract = sequelize.define('Contract', {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true
    },
    contractNumber: {
      type: DataTypes.STRING(30),
      allowNull: false,
      unique: true
    },
    requestId: {
      type: DataTypes.UUID,
      allowNull: false,
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
    templateId: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'ContractTemplates',
        key: 'id'
      }
    },
    // Contract Content
    terms: {
      type: DataTypes.TEXT,
      allowNull: false
    },
    deliverables: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    paymentTerms: {
      type: DataTypes.JSONB,
      allowNull: false
    },
    // Custom Clauses
    platformClauses: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    brandClauses: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    creatorClauses: {
      type: DataTypes.JSONB,
      defaultValue: []
    },
    // Signatures
    brandSignature: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    brandSignedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    brandSignedIP: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    brandSignerName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    creatorSignature: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    creatorSignedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    creatorSignedIP: {
      type: DataTypes.STRING(45),
      allowNull: true
    },
    creatorSignerName: {
      type: DataTypes.STRING(255),
      allowNull: true
    },
    // Status
    status: {
      type: DataTypes.ENUM('draft', 'pending_brand', 'pending_creator', 'active', 'completed', 'terminated', 'disputed'),
      defaultValue: 'draft'
    },
    // Compliance
    arconCompliance: {
      type: DataTypes.BOOLEAN,
      defaultValue: true
    },
    arconApprovalNumber: {
      type: DataTypes.STRING(50),
      allowNull: true
    },
    // Validity
    effectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    expiryDate: {
      type: DataTypes.DATEONLY,
      allowNull: true
    },
    // Termination
    terminatedAt: {
      type: DataTypes.DATE,
      allowNull: true
    },
    terminatedBy: {
      type: DataTypes.ENUM('brand', 'creator', 'admin', 'system'),
      allowNull: true
    },
    terminationReason: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    // PDF
    pdfUrl: {
      type: DataTypes.STRING(500),
      allowNull: true
    }
  }, {
    tableName: 'Contracts',
    timestamps: true,
    indexes: [
      { fields: ['contractNumber'], unique: true },
      { fields: ['requestId'] },
      { fields: ['brandId'] },
      { fields: ['creatorId'] },
      { fields: ['status'] }
    ]
  });

  Contract.associate = function(models) {
    Contract.belongsTo(models.CollaborationRequest, {
      foreignKey: 'requestId',
      as: 'request'
    });
    Contract.belongsTo(models.Brand, {
      foreignKey: 'brandId',
      as: 'brand'
    });
    Contract.belongsTo(models.Creator, {
      foreignKey: 'creatorId',
      as: 'creator'
    });
    Contract.belongsTo(models.ContractTemplate, {
      foreignKey: 'templateId',
      as: 'template'
    });
    Contract.hasMany(models.Payment, {
      foreignKey: 'contractId',
      as: 'payments'
    });
  };

  // Generate contract number
  Contract.generateContractNumber = function() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `CW-CON-${year}${month}-${random}`;
  };

  return Contract;
};
