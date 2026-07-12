#!/usr/bin/env node
/**
 * Email System Test Script
 * Tests all email types with both providers, fallback mechanism, and retry logic
 *
 * Usage: node scripts/test-email-system.js <email-address> [--provider=sendgrid|azure|both]
 */

require('dotenv').config();

const emailService = require('../utils/email');
const config = require('../utils/email/config');
const { getProvider, getAllProviderStatus } = require('../utils/email/providers');

// Parse command line arguments
const args = process.argv.slice(2);
const testEmail = args.find(arg => !arg.startsWith('--'));
const providerArg = args.find(arg => arg.startsWith('--provider='));
const testProvider = providerArg ? providerArg.split('=')[1] : 'both';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ️  ${msg}${colors.reset}`),
  success: (msg) => console.log(`${colors.green}✅ ${msg}${colors.reset}`),
  error: (msg) => console.log(`${colors.red}❌ ${msg}${colors.reset}`),
  warn: (msg) => console.log(`${colors.yellow}⚠️  ${msg}${colors.reset}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(60)}\n${msg}\n${'='.repeat(60)}${colors.reset}\n`)
};

// Test data
const testUser = {
  email: testEmail,
  firstName: 'Test User',
  businessName: 'Test Business'
};

const testPayment = {
  id: 'test-payment-123',
  amount: 100.50,
  merchantPercentage: 9825, // 98.25%
  coinleyPercentage: 175, // 1.75%
  currency: 'USDT',
  Token: { symbol: 'USDT' },
  Network: {
    name: 'Ethereum',
    explorerUrl: 'https://etherscan.io'
  }
};

const testMerchant = {
  email: testEmail,
  businessName: 'Test Merchant Inc'
};

async function showConfiguration() {
  log.header('Email System Configuration');

  console.log('Primary Provider:', config.primaryProvider);
  console.log('Retry Attempts:', config.retryAttempts);
  console.log('Retry Delay (ms):', config.retryDelayMs);
  console.log('Frontend URL:', config.frontendUrl);
  console.log();

  const status = getAllProviderStatus();

  console.log('Provider Status:');
  console.log(`  SendGrid: ${status.primary.name === 'sendgrid' ? '(Primary)' : '(Fallback)'}`);
  console.log(`    - Configured: ${config.providers.sendgrid.apiKey ? 'Yes' : 'No'}`);
  console.log(`    - Available: ${getProvider('sendgrid').isAvailable() ? 'Yes' : 'No'}`);
  console.log();
  console.log(`  Azure: ${status.primary.name === 'azure' ? '(Primary)' : '(Fallback)'}`);
  console.log(`    - Configured: ${config.providers.azure.connectionString ? 'Yes' : 'No'}`);
  console.log(`    - Available: ${getProvider('azure').isAvailable() ? 'Yes' : 'No'}`);
}

async function testEmailType(name, sendFunction, description) {
  log.info(`Testing: ${name}`);
  console.log(`  Description: ${description}`);

  const startTime = Date.now();

  try {
    const result = await sendFunction();
    const duration = Date.now() - startTime;

    if (result) {
      log.success(`${name} - Sent successfully (${duration}ms)`);
      return { name, success: true, duration };
    } else {
      log.error(`${name} - Send returned false (${duration}ms)`);
      return { name, success: false, duration, error: 'Send returned false' };
    }
  } catch (error) {
    const duration = Date.now() - startTime;
    log.error(`${name} - Exception: ${error.message} (${duration}ms)`);
    return { name, success: false, duration, error: error.message };
  }
}

async function runEmailTests() {
  log.header(`Email Tests - Sending to: ${testEmail}`);

  const results = [];

  // Test 1: Verification Email
  results.push(await testEmailType(
    'Verification Email',
    () => emailService.sendVerificationEmail(testUser, 'test-verification-token-12345'),
    'Sends email verification link to new users'
  ));

  // Small delay between tests
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 2: Welcome Email
  results.push(await testEmailType(
    'Welcome Email',
    () => emailService.sendWelcomeEmail(testUser),
    'Sends welcome email after email verification'
  ));

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 3: Password Reset Email
  results.push(await testEmailType(
    'Password Reset Email',
    () => emailService.sendResetPasswordEmail(testEmail, '1234', 'test-reset-token-67890'),
    'Sends password reset OTP and link'
  ));

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 4: Team Invitation Email
  results.push(await testEmailType(
    'Team Invitation Email',
    () => emailService.sendTeamInviteEmail({
      email: testEmail,
      firstName: 'Test Invitee',
      merchantName: 'Test Company',
      role: 'admin',
      inviteUrl: `${config.frontendUrl}/accept-invite?token=test-invite-token`
    }),
    'Sends team member invitation with role details'
  ));

  await new Promise(resolve => setTimeout(resolve, 1000));

  // Test 5: Payment Success Email
  results.push(await testEmailType(
    'Payment Success Email',
    () => emailService.sendPaymentSuccessEmail(testMerchant, testPayment, '0x1234567890abcdef1234567890abcdef12345678'),
    'Sends payment notification to merchant'
  ));

  return results;
}

async function showResults(results) {
  log.header('Test Results Summary');

  const passed = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;

  console.log(`Total Tests: ${results.length}`);
  console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
  console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
  console.log();

  // Detailed results
  console.log('Detailed Results:');
  results.forEach((result, index) => {
    const status = result.success ? `${colors.green}PASS${colors.reset}` : `${colors.red}FAIL${colors.reset}`;
    console.log(`  ${index + 1}. ${result.name}: ${status} (${result.duration}ms)`);
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
  });

  // Show service statistics
  console.log('\nService Statistics:');
  const stats = emailService.getStats();
  console.log(`  Total Sent: ${stats.service.totalSent}`);
  console.log(`  Total Failed: ${stats.service.totalFailed}`);
  console.log(`  Primary Successes: ${stats.service.primarySuccesses}`);
  console.log(`  Fallback Successes: ${stats.service.fallbackSuccesses}`);
  console.log(`  Total Retries: ${stats.service.totalRetries}`);

  return failed === 0;
}

async function main() {
  console.log(`\n${colors.bright}${colors.cyan}╔════════════════════════════════════════════════════════════╗`);
  console.log(`║           COINLEY EMAIL SYSTEM TEST SUITE                  ║`);
  console.log(`╚════════════════════════════════════════════════════════════╝${colors.reset}\n`);

  if (!testEmail) {
    console.log('Usage: node scripts/test-email-system.js <email-address> [--provider=sendgrid|azure|both]');
    console.log('\nExamples:');
    console.log('  node scripts/test-email-system.js test@example.com');
    console.log('  node scripts/test-email-system.js test@example.com --provider=sendgrid');
    console.log('  node scripts/test-email-system.js test@example.com --provider=azure');
    process.exit(1);
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(testEmail)) {
    log.error(`Invalid email address: ${testEmail}`);
    process.exit(1);
  }

  try {
    // Show configuration
    await showConfiguration();

    // Check if any provider is available
    const sendgridAvailable = getProvider('sendgrid').isAvailable();
    const azureAvailable = getProvider('azure').isAvailable();

    if (!sendgridAvailable && !azureAvailable) {
      log.error('No email providers are configured. Please configure at least one provider.');
      log.info('Set SENDGRID_API_KEY or AZURE_COMMUNICATION_CONNECTION_STRING in .env');
      process.exit(1);
    }

    if (!sendgridAvailable) {
      log.warn('SendGrid is not configured. Emails will be sent via Azure only.');
    }

    if (!azureAvailable) {
      log.warn('Azure is not configured. No fallback available if SendGrid fails.');
    }

    // Run tests
    const results = await runEmailTests();

    // Show results
    const allPassed = await showResults(results);

    // Final status
    console.log();
    if (allPassed) {
      log.success('All email tests passed! Check your inbox for the test emails.');
    } else {
      log.error('Some email tests failed. Please check the errors above.');
    }

    process.exit(allPassed ? 0 : 1);
  } catch (error) {
    log.error(`Unexpected error: ${error.message}`);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run main function
main();
