import runBlueDartTests from './test-bluedart.js';
import runDelhiveryTests from './test-delhivery.js';
import runEcomExpressTests from './test-ecomexpress.js';
import runEkartTests from './test-ekart.js';
import runXpressbeesTests from './test-xpressbees.js';

/**
 * Master Test Runner for All Delivery Partners
 * Runs comprehensive tests for all integrated delivery partners
 */

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Test runner configuration
const TEST_CONFIG = {
  // Set to true to run tests sequentially, false for parallel
  runSequential: true,

  // Set to true to continue testing other partners if one fails
  continueOnFailure: true,

  // Delivery partners to test
  partners: [
    { name: 'BlueDart', runner: runBlueDartTests, enabled: true },
    { name: 'EcomExpress', runner: runEcomExpressTests, enabled: true },
    { name: 'Ekart', runner: runEkartTests, enabled: true },
    { name: 'Delhivery', runner: runDelhiveryTests, enabled: true },
    { name: 'XpressBees', runner: runXpressbeesTests, enabled: true }
  ]
};

// Helper function to print colored output
const printColored = (color, text) => {
  console.log(color + text + colors.reset);
};

// Helper function to print a banner
const printBanner = (text, char = '=') => {
  const line = char.repeat(80);
  console.log('\n' + line);
  console.log(colors.bright + colors.cyan + text.toUpperCase() + colors.reset);
  console.log(line + '\n');
};

// Run tests for a single partner
const runPartnerTests = async (partner) => {
  printBanner(`Testing ${partner.name}`, '-');

  const startTime = Date.now();

  try {
    const results = await partner.runner();
    const duration = Date.now() - startTime;

    return {
      partner: partner.name,
      success: true,
      passed: results.passed,
      failed: results.failed,
      total: results.tests.length,
      duration: duration,
      details: results.tests
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    printColored(colors.red, `\n❌ ${partner.name} test suite crashed: ${error.message}`);

    return {
      partner: partner.name,
      success: false,
      passed: 0,
      failed: 0,
      total: 0,
      duration: duration,
      error: error.message,
      details: []
    };
  }
};

// Main test runner
const runAllTests = async () => {
  const startTime = Date.now();

  printBanner('🚀 MASTER DELIVERY PARTNER TEST SUITE', '═');

  console.log('📌 Test Configuration:');
  console.log(`   Run Mode: ${TEST_CONFIG.runSequential ? 'Sequential' : 'Parallel'}`);
  console.log(`   Continue on Failure: ${TEST_CONFIG.continueOnFailure ? 'Yes' : 'No'}`);
  console.log(`   Partners to Test: ${TEST_CONFIG.partners.filter(p => p.enabled).length}`);
  console.log('\n');

  // Filter enabled partners
  const enabledPartners = TEST_CONFIG.partners.filter(p => p.enabled);

  if (enabledPartners.length === 0) {
    printColored(colors.yellow, '⚠️  No delivery partners enabled for testing');
    return;
  }

  let allResults = [];

  if (TEST_CONFIG.runSequential) {
    // Run tests sequentially
    for (const partner of enabledPartners) {
      const result = await runPartnerTests(partner);
      allResults.push(result);

      if (!result.success && !TEST_CONFIG.continueOnFailure) {
        printColored(colors.red, '\n❌ Stopping tests due to failure');
        break;
      }
    }
  } else {
    // Run tests in parallel
    const promises = enabledPartners.map(partner => runPartnerTests(partner));
    allResults = await Promise.all(promises);
  }

  const totalDuration = Date.now() - startTime;

  // Print summary
  printBanner('📊 FINAL TEST SUMMARY', '═');

  // Calculate totals
  const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
  const totalTests = allResults.reduce((sum, r) => sum + r.total, 0);
  const successfulPartners = allResults.filter(r => r.success).length;

  // Print partner-wise summary
  console.log('📦 PARTNER-WISE RESULTS:\n');

  allResults.forEach((result, index) => {
    const statusIcon = result.success ? '✅' : '❌';
    const statusColor = result.success ? colors.green : colors.red;

    console.log(`${index + 1}. ${result.partner}:`);
    printColored(statusColor, `   ${statusIcon} Status: ${result.success ? 'COMPLETED' : 'FAILED'}`);

    if (result.success) {
      console.log(`   ✅ Passed: ${result.passed}`);
      console.log(`   ❌ Failed: ${result.failed}`);
      console.log(`   📋 Total Tests: ${result.total}`);
    } else {
      console.log(`   ❌ Error: ${result.error}`);
    }

    console.log(`   ⏱️  Duration: ${(result.duration / 1000).toFixed(2)}s`);
    console.log('');
  });

  // Print overall summary
  console.log(colors.bright + '\n📈 OVERALL STATISTICS:' + colors.reset);
  console.log(`   🏢 Partners Tested: ${allResults.length}`);
  console.log(`   ✅ Successful Partners: ${successfulPartners}`);
  console.log(`   ❌ Failed Partners: ${allResults.length - successfulPartners}`);
  console.log(`   📋 Total Tests Run: ${totalTests}`);
  console.log(`   ✅ Total Passed: ${totalPassed}`);
  console.log(`   ❌ Total Failed: ${totalFailed}`);
  console.log(`   ⏱️  Total Duration: ${(totalDuration / 1000).toFixed(2)}s`);

  // Calculate success rate
  const successRate = totalTests > 0 ? ((totalPassed / totalTests) * 100).toFixed(2) : 0;
  console.log(`   📊 Success Rate: ${successRate}%`);

  // Print detailed failures if any
  const failedTests = allResults.flatMap(r =>
    r.details.filter(t => !t.passed).map(t => ({
      partner: r.partner,
      test: t.name,
      error: t.error
    }))
  );

  if (failedTests.length > 0) {
    console.log('\n' + colors.red + colors.bright + '❌ FAILED TESTS DETAILS:' + colors.reset);
    failedTests.forEach((failure, index) => {
      console.log(`\n${index + 1}. ${failure.partner} - ${failure.test}:`);
      console.log(`   Error: ${failure.error || 'Unknown error'}`);
    });
  }

  // Final status
  console.log('\n' + '═'.repeat(80));
  if (totalFailed === 0 && successfulPartners === allResults.length) {
    printColored(colors.green + colors.bright, '✅ ALL TESTS PASSED SUCCESSFULLY! 🎉');
  } else if (totalPassed > 0) {
    printColored(colors.yellow + colors.bright, '⚠️  SOME TESTS FAILED - REVIEW REQUIRED');
  } else {
    printColored(colors.red + colors.bright, '❌ ALL TESTS FAILED - IMMEDIATE ATTENTION REQUIRED');
  }
  console.log('═'.repeat(80) + '\n');

  // Return summary for potential CI/CD integration
  return {
    success: totalFailed === 0 && successfulPartners === allResults.length,
    partners: allResults.length,
    successfulPartners,
    totalTests,
    totalPassed,
    totalFailed,
    successRate,
    duration: totalDuration,
    results: allResults
  };
};

// Run the master test suite
const isMainModule = import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) ||
  process.argv[1].endsWith('run-all-tests.js');

// Debug output
console.log('Script loaded. Running tests...');

if (isMainModule) {
  runAllTests()
    .then((summary) => {
      if (summary.success) {
        process.exit(0);
      } else {
        process.exit(1);
      }
    })
    .catch((error) => {
      printColored(colors.red, `\n❌ Master test suite crashed: ${error.message}`);
      console.error(error);
      process.exit(1);
    });
}

export default runAllTests;
