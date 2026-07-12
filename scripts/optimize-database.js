// scripts/optimize-database.js - Database Optimization Implementation Script

const { Sequelize } = require('sequelize');
const DatabaseOptimizer = require('../utils/database.optimizer');

/**
 * Database optimization script to implement recommended indexes and settings
 */
class DatabaseOptimization {
  constructor(sequelize) {
    this.sequelize = sequelize;
  }

  /**
   * Create all recommended indexes for optimal performance
   */
  async createRecommendedIndexes() {
    console.log('🗄️ Creating recommended database indexes...');

    const indexGroups = DatabaseOptimizer.getRecommendedIndexes();
    let totalIndexes = 0;
    let successCount = 0;
    let failureCount = 0;

    for (const group of indexGroups) {
      console.log(`\n📊 Creating indexes for ${group.table}:`);

      for (const indexSQL of group.indexes) {
        totalIndexes++;
        try {
          console.log(`  ⏳ Executing: ${indexSQL.substring(0, 80)}...`);

          // Extract index name for logging
          const indexNameMatch = indexSQL.match(/idx_\w+/);
          const indexName = indexNameMatch ? indexNameMatch[0] : 'unnamed';

          await this.sequelize.query(indexSQL);
          console.log(`  ✅ Index created successfully: ${indexName}`);
          successCount++;

          // Small delay to prevent overwhelming the database
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error) {
          failureCount++;
          if (error.message.includes('already exists')) {
            console.log(`  ⚠️ Index already exists (skipping)`);
            successCount++; // Count as success since index exists
            failureCount--; // Don't count as failure
          } else {
            console.error(`  ❌ Failed to create index:`, error.message);
          }
        }
      }
    }

    console.log(`\n📈 Index Creation Summary:`);
    console.log(`  Total: ${totalIndexes}`);
    console.log(`  Success: ${successCount}`);
    console.log(`  Failed: ${failureCount}`);

    return {
      total: totalIndexes,
      success: successCount,
      failed: failureCount
    };
  }

  /**
   * Analyze current database performance
   */
  async analyzePerformance() {
    console.log('\n🔍 Analyzing database performance...');

    try {
      const recommendations = await DatabaseOptimizer.analyzeQueryPerformance(this.sequelize);

      console.log('\n📊 Performance Analysis Results:');
      recommendations.forEach((rec, index) => {
        console.log(`\n${index + 1}. ${rec.type.toUpperCase()}:`);

        if (rec.type === 'slow_queries' && rec.queries) {
          console.log(`   Found ${rec.count} slow queries (>100ms):`);
          rec.queries.slice(0, 3).forEach((query, idx) => {
            console.log(`   ${idx + 1}. ${query.mean_exec_time.toFixed(2)}ms avg, ${query.calls} calls`);
            console.log(`      Query: ${query.query.substring(0, 100)}...`);
          });
        }

        if (rec.type === 'table_sizes' && rec.tables) {
          console.log(`   Table sizes:`);
          rec.tables.slice(0, 5).forEach(table => {
            console.log(`   • ${table.tablename}: ${table.size}`);
          });
        }
      });

      return recommendations;

    } catch (error) {
      console.warn('⚠️ Could not analyze performance (pg_stat_statements may not be enabled):', error.message);
      return [];
    }
  }

  /**
   * Optimize database connection pool
   */
  async optimizeConnectionPool() {
    console.log('\n🔧 Optimizing database connection pool...');

    const optimizedConfig = DatabaseOptimizer.getOptimizedPoolConfig();

    console.log('📋 Recommended connection pool settings:');
    console.log(`  Max connections: ${optimizedConfig.max}`);
    console.log(`  Min connections: ${optimizedConfig.min}`);
    console.log(`  Acquire timeout: ${optimizedConfig.acquire}ms`);
    console.log(`  Idle timeout: ${optimizedConfig.idle}ms`);
    console.log(`  Evict interval: ${optimizedConfig.evict}ms`);

    // Test current pool status
    try {
      const poolInfo = this.sequelize.connectionManager.pool;
      if (poolInfo) {
        console.log('\n📊 Current pool status:');
        console.log(`  Used connections: ${poolInfo.used}`);
        console.log(`  Available connections: ${poolInfo.available}`);
        console.log(`  Pending connections: ${poolInfo.pending}`);
      }
    } catch (error) {
      console.log('ℹ️ Could not retrieve current pool status');
    }

    return optimizedConfig;
  }

  /**
   * Run database maintenance tasks
   */
  async performMaintenance() {
    console.log('\n🧹 Performing database maintenance...');

    const maintenanceTasks = [
      {
        name: 'Update table statistics',
        sql: 'ANALYZE;',
        description: 'Updates table statistics for better query planning'
      },
      {
        name: 'Clean unused space',
        sql: 'VACUUM;',
        description: 'Reclaims storage occupied by dead tuples'
      }
    ];

    for (const task of maintenanceTasks) {
      try {
        console.log(`  ⏳ ${task.name}...`);
        await this.sequelize.query(task.sql);
        console.log(`  ✅ ${task.name} completed`);
      } catch (error) {
        console.error(`  ❌ ${task.name} failed:`, error.message);
      }
    }
  }

  /**
   * Generate database optimization report
   */
  async generateOptimizationReport() {
    console.log('\n📋 Generating optimization report...');

    const report = {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        dialect: this.sequelize.getDialect(),
        version: null
      },
      optimizations: {},
      recommendations: []
    };

    try {
      // Get database version
      const [versionResult] = await this.sequelize.query('SELECT version();');
      report.database.version = versionResult[0].version;
    } catch (error) {
      console.log('Could not retrieve database version');
    }

    // Run all optimization checks
    report.optimizations.indexes = await this.createRecommendedIndexes();
    report.optimizations.poolConfig = await this.optimizeConnectionPool();
    report.recommendations = await this.analyzePerformance();

    // Save report to file
    const fs = require('fs');
    const path = require('path');
    const reportPath = path.join(__dirname, '..', 'logs', `db-optimization-${Date.now()}.json`);

    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(reportPath);
      if (!fs.existsSync(logsDir)) {
        fs.mkdirSync(logsDir, { recursive: true });
      }

      fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
      console.log(`📄 Optimization report saved to: ${reportPath}`);
    } catch (error) {
      console.error('Could not save optimization report:', error.message);
    }

    return report;
  }
}

/**
 * Main optimization execution function
 */
async function runDatabaseOptimization() {
  console.log('🚀 Starting database optimization process...');

  try {
    // Import database connection
    const db = require('../models');
    const sequelize = db.sequelize;

    // Test database connection
    await sequelize.authenticate();
    console.log('✅ Database connection established');

    // Initialize optimizer
    const optimizer = new DatabaseOptimization(sequelize);

    // Run full optimization
    const report = await optimizer.generateOptimizationReport();

    // Perform maintenance
    await optimizer.performMaintenance();

    console.log('\n🎉 Database optimization completed successfully!');
    console.log(`📊 Summary:`);
    console.log(`  - Indexes created: ${report.optimizations.indexes.success}/${report.optimizations.indexes.total}`);
    console.log(`  - Performance recommendations: ${report.recommendations.length}`);

    return report;

  } catch (error) {
    console.error('❌ Database optimization failed:', error);
    throw error;
  }
}

// Export for use in other scripts
module.exports = {
  DatabaseOptimization,
  runDatabaseOptimization
};

// Allow script to be run directly
if (require.main === module) {
  runDatabaseOptimization()
    .then(() => {
      console.log('✨ Optimization script completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 Optimization script failed:', error);
      process.exit(1);
    });
}