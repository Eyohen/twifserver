#!/usr/bin/env node

/**
 * Twif Server Startup Script
 *
 * This script ensures proper initialization sequence:
 * 1. Environment validation
 * 2. Database connection test
 * 3. Migration check and execution
 * 4. Server startup
 */

// ✅ Load environment variables first
require('dotenv').config();

const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                  TWIF STARTUP SCRIPT                    ║
║                                                               ║
║  This script will prepare your environment and start the     ║
║  Twif server with proper database migrations.           ║
╚═══════════════════════════════════════════════════════════════╝

🔍 ENVIRONMENT VALIDATION:
`);

// Check environment variables
const requiredEnvVars = [
  'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'
];

let envValid = true;
for (const envVar of requiredEnvVars) {
  if (process.env[envVar]) {
    console.log(`✅ ${envVar}: SET`);
  } else {
    console.log(`❌ ${envVar}: MISSING`);
    envValid = false;
  }
}

if (!envValid) {
  console.log(`
❌ ENVIRONMENT VALIDATION FAILED

Please ensure all required environment variables are set in your .env file:
- DB_HOST (database host)
- DB_PORT (database port, usually 5432)
- DB_NAME (database name)
- DB_USER (database username)
- DB_PASSWORD (database password)

Example .env file:
DB_HOST=localhost
DB_PORT=5432
DB_NAME=twif
DB_USER=postgres
DB_PASSWORD=yourpassword
NODE_ENV=development
`);
  process.exit(1);
}

console.log('\n✅ Environment validation passed\n');

async function startServer() {
  try {
    console.log('🔄 STARTING TWIF SERVER...\n');

    // Test database connection first
    console.log('1️⃣  Testing database connection...');
    try {
      const db = require('./models');
      await db.sequelize.authenticate();
      console.log('✅ Database connection successful\n');
    } catch (error) {
      console.log('❌ Database connection failed:', error.message);
      console.log('💡 Please check your database configuration and ensure PostgreSQL is running\n');
      process.exit(1);
    }

    // Check migration status
    console.log('2️⃣  Checking migration status...');
    try {
      const { stdout } = await execPromise('npx sequelize-cli db:migrate:status');

      if (stdout.includes('down')) {
        console.log('📋 Pending migrations found, running migrations...');
        await execPromise('npx sequelize-cli db:migrate');
        console.log('✅ Migrations completed successfully\n');
      } else {
        console.log('✅ All migrations up to date\n');
      }
    } catch (error) {
      console.log('⚠️  Migration check failed:', error.message);
      console.log('💡 Continuing with server startup...\n');
    }

    // Start the main server
    console.log('3️⃣  Starting main server process...\n');
    console.log('═'.repeat(65));

    // Use spawn to start the main server process
    const { spawn } = require('child_process');
    const serverProcess = spawn('node', ['index.js'], {
      stdio: 'inherit',
      cwd: __dirname
    });

    serverProcess.on('error', (error) => {
      console.error('💀 Server process failed:', error.message);
      process.exit(1);
    });

    serverProcess.on('exit', (code) => {
      if (code !== 0) {
        console.error(`💀 Server process exited with code ${code}`);
        process.exit(code);
      }
    });

    // Forward signals to child process
    process.on('SIGINT', () => {
      serverProcess.kill('SIGINT');
    });

    process.on('SIGTERM', () => {
      serverProcess.kill('SIGTERM');
    });

  } catch (error) {
    console.error('💀 STARTUP FAILED:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Handle startup process
if (require.main === module) {
  startServer();
}

module.exports = { startServer };
