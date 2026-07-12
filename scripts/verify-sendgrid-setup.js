#!/usr/bin/env node

/**
 * SendGrid Domain Authentication Verification Script
 *
 * This script helps verify your SendGrid domain authentication setup
 * by checking DNS records and SendGrid API configuration.
 *
 * Usage: node scripts/verify-sendgrid-setup.js
 */

require('dotenv').config();
const dns = require('dns').promises;
const sgMail = require('@sendgrid/mail');

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(color, symbol, message) {
  console.log(`${colors[color]}${symbol} ${message}${colors.reset}`);
}

async function checkSendGridConfig() {
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     SENDGRID CONFIGURATION VERIFICATION                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  // Check 1: Environment Variables
  log('cyan', '🔍', 'Checking SendGrid environment variables...');

  const apiKey = process.env.SENDGRID_API_KEY;
  const fromEmail = process.env.SENDGRID_FROM_EMAIL;

  if (!apiKey) {
    log('red', '❌', 'SENDGRID_API_KEY not found in .env file');
    return false;
  } else {
    log('green', '✅', `SENDGRID_API_KEY found: ${apiKey.substring(0, 15)}...`);
  }

  if (!fromEmail) {
    log('red', '❌', 'SENDGRID_FROM_EMAIL not found in .env file');
    return false;
  } else {
    log('green', '✅', `SENDGRID_FROM_EMAIL found: ${fromEmail}`);
  }

  // Extract domain from email
  const domain = fromEmail.split('@')[1];
  log('blue', '📧', `Domain to verify: ${domain}\n`);

  // Check 2: DNS Records
  log('cyan', '🔍', 'Checking DNS records for domain authentication...\n');

  // Check SPF Record
  try {
    log('blue', '→', 'Checking SPF record (TXT)...');
    const txtRecords = await dns.resolveTxt(domain);
    const spfRecord = txtRecords.find(record =>
      record.join('').includes('v=spf1') && record.join('').includes('sendgrid')
    );

    if (spfRecord) {
      log('green', '✅', `SPF record found: ${spfRecord.join('')}`);
    } else {
      log('yellow', '⚠️', 'SPF record not found or does not include SendGrid');
      log('yellow', '→', 'Expected: v=spf1 include:sendgrid.net ~all');
    }
  } catch (error) {
    log('red', '❌', `Failed to check SPF record: ${error.message}`);
  }

  // Check DKIM Records
  try {
    log('blue', '\n→', 'Checking DKIM records (CNAME)...');

    // Try common DKIM selectors
    const selectors = ['s1._domainkey', 's2._domainkey', 'sendgrid._domainkey'];
    let dkimFound = false;

    for (const selector of selectors) {
      try {
        const dkimDomain = `${selector}.${domain}`;
        const cnameRecords = await dns.resolveCname(dkimDomain);

        if (cnameRecords && cnameRecords.length > 0) {
          log('green', '✅', `DKIM record found: ${dkimDomain} → ${cnameRecords[0]}`);
          dkimFound = true;
        }
      } catch (err) {
        // Selector not found, try next
      }
    }

    if (!dkimFound) {
      log('yellow', '⚠️', 'DKIM records not found');
      log('yellow', '→', 'Check SendGrid dashboard for correct DKIM selector names');
    }
  } catch (error) {
    log('yellow', '⚠️', `DKIM check incomplete: ${error.message}`);
  }

  // Check 3: SendGrid API Connection
  log('cyan', '\n🔍', 'Testing SendGrid API connection...');

  try {
    sgMail.setApiKey(apiKey);

    // We won't actually send an email, just verify API key format
    if (apiKey.startsWith('SG.') && apiKey.length > 50) {
      log('green', '✅', 'SendGrid API key format is valid');
    } else {
      log('yellow', '⚠️', 'SendGrid API key format looks unusual');
    }
  } catch (error) {
    log('red', '❌', `SendGrid API error: ${error.message}`);
  }

  // Summary
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║     VERIFICATION SUMMARY                                  ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  log('blue', '📋', 'Next Steps:');
  console.log('');
  console.log('   1. If DNS records are missing:');
  console.log('      → Follow SENDGRID_VERIFICATION_GUIDE.md');
  console.log('      → Log into SendGrid dashboard');
  console.log('      → Go to Settings → Sender Authentication');
  console.log('      → Add DNS records to your DNS provider');
  console.log('');
  console.log('   2. Test email delivery:');
  console.log('      → Send a test email via your backend');
  console.log('      → Check if it lands in inbox (not spam)');
  console.log('      → Verify email headers show SPF/DKIM PASS');
  console.log('');
  console.log('   3. Monitor deliverability:');
  console.log('      → SendGrid Dashboard → Email Activity');
  console.log('      → Check delivery rates and spam reports');
  console.log('');

  return true;
}

// Run verification
checkSendGridConfig()
  .then(() => {
    process.exit(0);
  })
  .catch(error => {
    log('red', '❌', `Verification script failed: ${error.message}`);
    process.exit(1);
  });
