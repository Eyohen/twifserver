// cleanup-seeder.js
const { Sequelize } = require('sequelize');
const config = require('./config/config.js').development;

async function cleanupDatabase() {
  try {
    // Create a new Sequelize instance
    const sequelize = new Sequelize(
      config.database,
      config.username,
      config.password,
      {
        host: config.host,
        dialect: config.dialect,
        logging: console.log
      }
    );

    // Test the connection
    await sequelize.authenticate();
    console.log('Connected to the database successfully.');

    // Delete all records from Tokens table
    await sequelize.query('DELETE FROM "Tokens"');
    console.log('Deleted all records from Tokens table.');

    // Delete all records from Networks table
    await sequelize.query('DELETE FROM "Networks"');
    console.log('Deleted all records from Networks table.');

    // Close the connection
    await sequelize.close();
    console.log('Database connection closed.');
  } catch (error) {
    console.error('Error cleaning up database:', error);
  }
}

// Run the cleanup function
cleanupDatabase();