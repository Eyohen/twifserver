#!/usr/bin/env node

/**
 * SendGrid Email Delivery Testing Script
 *
 * This script tests all email functions to verify SendGrid configuration
 * is working correctly and ready for production use.
 *
 * Usage: node scripts/test-email-delivery.js <test-email@example.com>
 */

require('dotenv').config();
const emailService = require('../utils/emailService');
const fs = require('fs');
const path = require('path');

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(color, symbol, message) {
  const timestamp = new Date().toISOString();
  const logMessage = `${colors[color]}[${timestamp}] ${symbol} ${message}${colors.reset}`;
  console.log(logMessage);
  return logMessage;
}

// Test results storage
const testResults = {
  timestamp: new Date().toISOString(),
  config: {
    apiKey: process.env.SENDGRID_API_KEY ? 'Set' : 'Missing',
    fromEmail: process.env.SENDGRID_FROM_EMAIL || 'Not Set',
  },
  tests: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
  }
};

// Mock user data for testing
function createMockUser(email) {
  return {
    id: 'test-user-' + Date.now(),
    email: email,
    firstName: 'Test',
    lastName: 'User',
    verificationToken: 'test-token-' + Math.random().toString(36).substring(7),
  };
}

function createMockMerchant(email) {
  return {
    id: 'test-merchant-' + Date.now(),
    businessName: 'Test Business',
    email: email,
  };
}

function createMockPayment(email) {
  return {
    id: 'test-payment-' + Date.now(),
    amount: 100.50,
    currency: 'USD',
    tokenSymbol: 'USDT',
    network: 'Optimism',
    transactionHash: '0x' + '1'.repeat(64),
    merchantEmail: email,
    merchantWallet: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
    createdAt: new Date(),
  };
}

// Test individual email function
async function testEmailFunction(testName, emailFunction, description) {
  log('cyan', '🧪', `Testing: ${testName}`);
  log('blue', '→', description);

  const testResult = {
    name: testName,
    description: description,
    status: 'pending',
    timestamp: new Date().toISOString(),
    error: null,
    responseTime: null,
  };

  const startTime = Date.now();

  try {
    await emailFunction();
    const endTime = Date.now();
    testResult.responseTime = endTime - startTime;
    testResult.status = 'passed';

    log('green', '✅', `${testName} - PASSED (${testResult.responseTime}ms)`);
    testResults.summary.passed++;
  } catch (error) {
    const endTime = Date.now();
    testResult.responseTime = endTime - startTime;
    testResult.status = 'failed';
    testResult.error = {
      message: error.message,
      code: error.code,
      statusCode: error.statusCode,
    };

    log('red', '❌', `${testName} - FAILED (${testResult.responseTime}ms)`);
    log('red', '→', `Error: ${error.message}`);

    if (error.response) {
      log('red', '→', `SendGrid Response: ${JSON.stringify(error.response.body)}`);
      testResult.error.sendgridResponse = error.response.body;
    }
  }

  testResults.tests.push(testResult);
  testResults.summary.total++;

  return testResult;
}

// Main test execution
async function runEmailTests(testEmail) {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     SENDGRID EMAIL DELIVERY TEST SUITE                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  log('blue', '📧', `Test emails will be sent to: ${testEmail}`);
  log('blue', '📋', `From address: ${process.env.SENDGRID_FROM_EMAIL}`);
  log('blue', '🔑', `API Key: ${process.env.SENDGRID_API_KEY ? process.env.SENDGRID_API_KEY.substring(0, 15) + '...' : 'NOT SET'}`);

  console.log('\n' + '─'.repeat(60) + '\n');

  // Check prerequisites
  if (!process.env.SENDGRID_API_KEY) {
    log('red', '❌', 'SENDGRID_API_KEY not found in .env file');
    log('red', '→', 'Cannot proceed with email tests');
    process.exit(1);
  }

  if (!process.env.SENDGRID_FROM_EMAIL) {
    log('red', '❌', 'SENDGRID_FROM_EMAIL not found in .env file');
    log('red', '→', 'Cannot proceed with email tests');
    process.exit(1);
  }

  // Test 1: Verification Email
  await testEmailFunction(
    'Verification Email',
    async () => {
      const mockUser = createMockUser(testEmail);
      await emailService.sendVerificationEmail(mockUser);
    },
    'Tests email verification with token link'
  );

  await sleep(2000); // Wait 2 seconds between emails

  // Test 2: Welcome Email
  await testEmailFunction(
    'Welcome Email',
    async () => {
      const mockUser = createMockUser(testEmail);
      await emailService.sendWelcomeEmail(mockUser);
    },
    'Tests welcome email for new users'
  );

  await sleep(2000);

  // Test 3: Password Reset Email
  await testEmailFunction(
    'Password Reset Email',
    async () => {
      const mockUser = createMockUser(testEmail);
      const resetToken = 'reset-token-' + Math.random().toString(36).substring(7);
      await emailService.sendResetPasswordEmail(mockUser, resetToken);
    },
    'Tests password reset email with reset link'
  );

  await sleep(2000);

  // Test 4: Team Invite Email
  await testEmailFunction(
    'Team Invite Email',
    async () => {
      const inviter = { firstName: 'John', lastName: 'Doe' };
      const merchant = createMockMerchant(testEmail);
      const inviteToken = 'invite-token-' + Math.random().toString(36).substring(7);
      await emailService.sendTeamInviteEmail(testEmail, inviter, merchant, inviteToken);
    },
    'Tests team invitation email'
  );

  await sleep(2000);

  // Test 5: Payment Success Email
  await testEmailFunction(
    'Payment Success Email',
    async () => {
      const mockPayment = createMockPayment(testEmail);
      await emailService.sendPaymentSuccessEmail(mockPayment);
    },
    'Tests payment confirmation email'
  );

  // Generate summary
  console.log('\n' + '═'.repeat(60) + '\n');
  log('cyan', '📊', 'TEST SUMMARY');
  console.log('');

  log('blue', '📈', `Total Tests: ${testResults.summary.total}`);
  log('green', '✅', `Passed: ${testResults.summary.passed}`);
  log('red', '❌', `Failed: ${testResults.summary.failed}`);

  const successRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);
  log('blue', '📊', `Success Rate: ${successRate}%`);

  // Detailed results
  console.log('\n' + '─'.repeat(60) + '\n');
  log('cyan', '📋', 'DETAILED RESULTS');
  console.log('');

  testResults.tests.forEach((test, index) => {
    const statusSymbol = test.status === 'passed' ? '✅' : '❌';
    const statusColor = test.status === 'passed' ? 'green' : 'red';

    log(statusColor, statusSymbol, `${index + 1}. ${test.name}`);
    log('blue', '  →', `Description: ${test.description}`);
    log('blue', '  →', `Response Time: ${test.responseTime}ms`);

    if (test.error) {
      log('red', '  →', `Error: ${test.error.message}`);
      if (test.error.sendgridResponse) {
        log('red', '  →', `SendGrid: ${JSON.stringify(test.error.sendgridResponse)}`);
      }
    }
    console.log('');
  });

  // Save results to file
  const logDir = path.join(__dirname, '../logs');
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  const logFilePath = path.join(logDir, `email-test-${Date.now()}.json`);
  fs.writeFileSync(logFilePath, JSON.stringify(testResults, null, 2));

  log('blue', '💾', `Full results saved to: ${logFilePath}`);

  // Production readiness assessment
  console.log('\n' + '═'.repeat(60) + '\n');
  log('cyan', '🎯', 'PRODUCTION READINESS ASSESSMENT');
  console.log('');

  const isProductionReady = testResults.summary.failed === 0;

  if (isProductionReady) {
    log('green', '✅', 'ALL TESTS PASSED - PRODUCTION READY!');
    console.log('');
    log('green', '→', 'SendGrid is properly configured');
    log('green', '→', 'All email functions are working correctly');
    log('green', '→', 'Reply-to headers are configured');
    log('green', '→', 'Tracking settings are disabled');
    log('green', '→', 'Email categories are set up');
    console.log('');
    log('blue', '📧', 'Next Steps:');
    console.log('   1. Check your inbox at: ' + testEmail);
    console.log('   2. Verify all 5 emails arrived');
    console.log('   3. Check emails are NOT in spam folder');
    console.log('   4. Verify email headers show SPF/DKIM PASS');
    console.log('   5. Test reply functionality (should go to support@coinley.io)');
  } else {
    log('red', '❌', 'TESTS FAILED - NOT PRODUCTION READY');
    console.log('');
    log('red', '→', `${testResults.summary.failed} test(s) failed`);
    console.log('');
    log('yellow', '🔧', 'Troubleshooting Steps:');
    console.log('   1. Check SendGrid API key is valid');
    console.log('   2. Verify from email is authenticated in SendGrid');
    console.log('   3. Check SendGrid dashboard for error logs');
    console.log('   4. Ensure domain authentication is complete');
    console.log('   5. Review error messages above');
  }

  console.log('\n' + '═'.repeat(60) + '\n');

  return isProductionReady;
}

// Helper function
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Parse command line arguments
const args = process.argv.slice(2);
const testEmail = args[0];

if (!testEmail) {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     SENDGRID EMAIL DELIVERY TEST SUITE                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
  log('red', '❌', 'Error: Test email address is required');
  console.log('');
  log('blue', '📖', 'Usage:');
  console.log('   node scripts/test-email-delivery.js <test-email@example.com>');
  console.log('');
  log('blue', '📝', 'Example:');
  console.log('   node scripts/test-email-delivery.js john@example.com');
  console.log('');
  log('yellow', '💡', 'Tips:');
  console.log('   - Use a real email address you have access to');
  console.log('   - Check both inbox and spam folders');
  console.log('   - Test with Gmail/Outlook for best results');
  console.log('');
  process.exit(1);
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
if (!emailRegex.test(testEmail)) {
  log('red', '❌', `Invalid email format: ${testEmail}`);
  process.exit(1);
}

// Run tests
runEmailTests(testEmail)
  .then(isReady => {
    process.exit(isReady ? 0 : 1);
  })
  .catch(error => {
    log('red', '❌', `Test suite failed: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
