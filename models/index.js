'use strict';

const path = require('path');
const Sequelize = require('sequelize');
const env = process.env.NODE_ENV || 'development';
const config = require(__dirname + '/../config/config.js')[env];
const db = {};

const activeModelFiles = [
  'staffUser.js',
  'customer.js',
  'invoice.js',
  'orderSheet.js',
  'fabric.js',
  'omsNotification.js',
  'inventoryAllocation.js',
  'sentInvoice.js',
  'admin.js',
  'user.js',
  'personalProfile.js',
  'businessProfile.js',
  'connection.js',
  'opportunity.js',
  'opportunityInterest.js',
  'notification.js',
  'booking.js',
  'auditLog.js',
];

let sequelize;
if (config.use_env_variable) {
  sequelize = new Sequelize(process.env[config.use_env_variable], config);
} else {
  sequelize = new Sequelize(config.database, config.username, config.password, config);
}

activeModelFiles.forEach((file) => {
  const model = require(path.join(__dirname, file))(sequelize, Sequelize.DataTypes);
  db[model.name] = model;
});

Object.keys(db).forEach(modelName => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

db.sequelize = sequelize;
db.Sequelize = Sequelize;

module.exports = db;
