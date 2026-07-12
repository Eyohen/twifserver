#!/bin/bash

# Email Testing Script with Logging
# Usage: bash scripts/run-email-tests.sh <test-email@example.com>

set -e

# Check if email is provided
if [ -z "$1" ]; then
    echo "❌ Error: Test email address is required"
    echo ""
    echo "Usage: bash scripts/run-email-tests.sh <test-email@example.com>"
    echo ""
    echo "Example: bash scripts/run-email-tests.sh test@gmail.com"
    exit 1
fi

TEST_EMAIL="$1"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
LOG_DIR="logs"
LOG_FILE="${LOG_DIR}/email-test-${TIMESTAMP}.log"

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

echo "╔═══════════════════════════════════════════════════════════╗"
echo "║     RUNNING EMAIL DELIVERY TESTS                         ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo ""
echo "📧 Test Email: $TEST_EMAIL"
echo "📝 Log File: $LOG_FILE"
echo ""

# Run the test script and tee output to both console and log file
node scripts/test-email-delivery.js "$TEST_EMAIL" 2>&1 | tee "$LOG_FILE"

# Capture exit code
EXIT_CODE=${PIPESTATUS[0]}

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "📋 Test completed with exit code: $EXIT_CODE"
echo "📝 Full log saved to: $LOG_FILE"
echo ""

# Show location of JSON results
JSON_RESULTS=$(ls -t "${LOG_DIR}"/email-test-*.json 2>/dev/null | head -1)
if [ -n "$JSON_RESULTS" ]; then
    echo "📊 JSON results: $JSON_RESULTS"
fi

echo ""

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ All tests passed - Production ready!"
else
    echo "❌ Some tests failed - Review logs above"
fi

exit $EXIT_CODE
