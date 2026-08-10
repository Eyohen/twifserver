'use strict';

// A comment thread on a job sheet, as the scope calls for.
//
// Comments are their own table rather than another key inside the invoice's
// JSONB payload: a thread grows without limit, and two people commenting at
// once would each write back a whole payload read moments earlier, so one of
// them would lose their comment.
module.exports = (sequelize, DataTypes) => sequelize.define('JobComment', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  // The job sheet is identified by its invoice, the way every other record
  // that hangs off a job is.
  invoiceNumber: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  authorName: {
    type: DataTypes.STRING(120),
    allowNull: false,
  },
  authorRole: {
    type: DataTypes.STRING(40),
    allowNull: false,
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
}, {
  tableName: 'JobComments',
  timestamps: true,
  indexes: [
    { fields: ['invoiceNumber', 'createdAt'] },
  ],
});
