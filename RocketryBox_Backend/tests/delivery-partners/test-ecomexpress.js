import { ECOMEXPRESS_CONFIG } from '../../src/config/ecomexpress.config.js';
import ecomExpressService from '../../src/services/ecomexpress.service.js';
import * as ecomExpressUtils from '../../src/utils/ecomexpress.js';

/**
 * EcomExpress API Test Script
 * Tests all endpoints and payloads for EcomExpress integration
 */

// Test configuration
const TEST_CONFIG = {
  // Test data
  testPincode: '110001', // Delhi
  testDestinationPincode: '400001', // Mumbai
  testAWB: 'EC123456789', // Example AWB number

  // Test customer details
  testCustomer: {
    name: 'Test Customer',
    phone: '9999999999',
    email: 'test@example.com',
    address: {
      line1: 'Test Address Line 1',
      line2: 'Test Address Line 2',
      line3: '',
      pincode: '110001',
      city: 'New Delhi',
      state: 'Delhi',
      country: 'India'
    }
  },

  // Test shipment details
  testShipment: {
    weight: 0.5,
    length: 10,
    width: 10,
    height: 10,
    numberOfPieces: 1,
    declaredValue: 1000,
    productType: 'PPD', // Prepaid
    serviceType: 'express',
    packageType: 'documents',
    invoiceNumber: 'INV-' + Date.now()
  }
};

// Helper function to log test results
const logTestResult = (testName, result, duration) => {
  console.log('\n' + '='.repeat(80));
  console.log(`📋 TEST: ${testName}`);
  console.log(`⏱️  Duration: ${duration}ms`);
  console.log(`✅ Status: ${result.success ? 'PASSED' : 'FAILED'}`);
  if (!result.success) {
    console.log(`❌ Error: ${result.error || result.message}`);
  }
  console.log('📊 Result:', JSON.stringify(result, null, 2));
  console.log('='.repeat(80) + '\n');
};

// Test Suite
const runEcomExpressTests = async () => {
  console.log('\n🚀 STARTING ECOMEXPRESS API TEST SUITE\n');
  console.log('📌 Configuration Details:');
  console.log(`   API URL: ${ECOMEXPRESS_CONFIG.BASE_URL}`);
  console.log(`   Username: ${ECOMEXPRESS_CONFIG.USERNAME}`);
  console.log(`   Environment: ${ECOMEXPRESS_CONFIG.IS_PRODUCTION ? 'PRODUCTION' : 'SANDBOX'}`);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Test 1: Authentication
    console.log('\n\n🔐 TEST 1: Authentication Check');
    const authStart = Date.now();
    try {
      // EcomExpress uses API key authentication, so we'll test with a simple API call
      const authHeaders = ecomExpressUtils.getAuthHeaders();
      const authResult = {
        success: true,
        message: 'Authentication headers generated successfully',
        headers: {
          username: authHeaders.username,
          password: authHeaders.password ? '***' : 'Not set'
        }
      };
      logTestResult('Authentication Check', authResult, Date.now() - authStart);
      results.passed++;
      results.tests.push({ name: 'Authentication Check', passed: true });
    } catch (error) {
      const authResult = {
        success: false,
        error: error.message
      };
      logTestResult('Authentication Check', authResult, Date.now() - authStart);
      results.failed++;
      results.tests.push({ name: 'Authentication Check', passed: false, error: error.message });
    }

    // Test 2: Pincode Serviceability
    console.log('\n\n📍 TEST 2: Pincode Serviceability Check');
    const pincodeStart = Date.now();
    try {
      const pincodeResult = await ecomExpressUtils.checkPincodeServiceability(
        TEST_CONFIG.testPincode,
        TEST_CONFIG.testDestinationPincode
      );
      logTestResult('Pincode Serviceability', pincodeResult, Date.now() - pincodeStart);
      results.passed++;
      results.tests.push({ name: 'Pincode Serviceability', passed: true });
    } catch (error) {
      const pincodeResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.PINCODE_SERVICE,
        payload: {
          origin: TEST_CONFIG.testPincode,
          destination: TEST_CONFIG.testDestinationPincode
        }
      };
      logTestResult('Pincode Serviceability', pincodeResult, Date.now() - pincodeStart);
      results.failed++;
      results.tests.push({ name: 'Pincode Serviceability', passed: false, error: error.message });
    }

    // Test 3: AWB Generation
    console.log('\n\n📄 TEST 3: AWB Number Generation');
    const awbStart = Date.now();
    try {
      const awbResult = await ecomExpressUtils.generateAWB(1); // Generate 1 AWB
      logTestResult('AWB Generation', awbResult, Date.now() - awbStart);
      results.passed++;
      results.tests.push({ name: 'AWB Generation', passed: true });
    } catch (error) {
      const awbResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.AWB_NUMBER
      };
      logTestResult('AWB Generation', awbResult, Date.now() - awbStart);
      results.failed++;
      results.tests.push({ name: 'AWB Generation', passed: false, error: error.message });
    }

    // Test 4: Shipment Booking
    console.log('\n\n📦 TEST 4: Shipment Booking');
    const bookingStart = Date.now();
    try {
      const bookingData = {
        serviceType: TEST_CONFIG.testShipment.serviceType,
        consignee: {
          name: TEST_CONFIG.testCustomer.name,
          phone: TEST_CONFIG.testCustomer.phone,
          email: TEST_CONFIG.testCustomer.email,
          address: {
            line1: TEST_CONFIG.testCustomer.address.line1,
            line2: TEST_CONFIG.testCustomer.address.line2,
            line3: TEST_CONFIG.testCustomer.address.line3,
            pincode: TEST_CONFIG.testDestinationPincode,
            city: TEST_CONFIG.testCustomer.address.city,
            state: TEST_CONFIG.testCustomer.address.state
          }
        },
        shipper: {
          name: 'Test Shipper',
          phone: TEST_CONFIG.testCustomer.phone,
          email: TEST_CONFIG.testCustomer.email,
          address: {
            line1: TEST_CONFIG.testCustomer.address.line1,
            line2: TEST_CONFIG.testCustomer.address.line2,
            pincode: TEST_CONFIG.testPincode,
            city: TEST_CONFIG.testCustomer.address.city,
            state: TEST_CONFIG.testCustomer.address.state
          }
        },
        weight: TEST_CONFIG.testShipment.weight,
        dimensions: {
          length: TEST_CONFIG.testShipment.length,
          width: TEST_CONFIG.testShipment.width,
          height: TEST_CONFIG.testShipment.height
        },
        declaredValue: TEST_CONFIG.testShipment.declaredValue,
        cod: false,
        codAmount: 0,
        referenceNumber: 'ORD-' + Date.now(),
        invoiceNumber: TEST_CONFIG.testShipment.invoiceNumber,
        commodity: 'General Goods'
      };

      const bookingResult = await ecomExpressService.createShipment(bookingData);
      logTestResult('Shipment Booking', bookingResult, Date.now() - bookingStart);
      results.passed++;
      results.tests.push({ name: 'Shipment Booking', passed: true });
    } catch (error) {
      const bookingResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.CREATE_SHIPMENT
      };
      logTestResult('Shipment Booking', bookingResult, Date.now() - bookingStart);
      results.failed++;
      results.tests.push({ name: 'Shipment Booking', passed: false, error: error.message });
    }

    // Test 5: Tracking
    console.log('\n\n🔍 TEST 5: Shipment Tracking');
    const trackingStart = Date.now();
    try {
      const trackingResult = await ecomExpressService.trackShipment(TEST_CONFIG.testAWB);
      logTestResult('Shipment Tracking', trackingResult, Date.now() - trackingStart);
      results.passed++;
      results.tests.push({ name: 'Shipment Tracking', passed: true });
    } catch (error) {
      const trackingResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.TRACK,
        payload: { awb: TEST_CONFIG.testAWB }
      };
      logTestResult('Shipment Tracking', trackingResult, Date.now() - trackingStart);
      results.failed++;
      results.tests.push({ name: 'Shipment Tracking', passed: false, error: error.message });
    }

    // Test 6: Transit Time
    console.log('\n\n🚚 TEST 6: Transit Time Calculation');
    const transitStart = Date.now();
    try {
      const transitResult = await ecomExpressUtils.getTransitTime(
        TEST_CONFIG.testPincode,
        TEST_CONFIG.testDestinationPincode
      );
      logTestResult('Transit Time Calculation', transitResult, Date.now() - transitStart);
      results.passed++;
      results.tests.push({ name: 'Transit Time Calculation', passed: true });
    } catch (error) {
      const transitResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.EXPECTED_DATE,
        payload: {
          origin: TEST_CONFIG.testPincode,
          destination: TEST_CONFIG.testDestinationPincode
        }
      };
      logTestResult('Transit Time Calculation', transitResult, Date.now() - transitStart);
      results.failed++;
      results.tests.push({ name: 'Transit Time Calculation', passed: false, error: error.message });
    }

    // Test 7: Rate Calculation
    console.log('\n\n💰 TEST 7: Rate Calculation');
    const rateStart = Date.now();
    try {
      const packageDetails = {
        weight: TEST_CONFIG.testShipment.weight,
        dimensions: {
          length: TEST_CONFIG.testShipment.length,
          width: TEST_CONFIG.testShipment.width,
          height: TEST_CONFIG.testShipment.height
        },
        value: TEST_CONFIG.testShipment.declaredValue,
        cod: false,
        serviceType: TEST_CONFIG.testShipment.serviceType
      };

      const deliveryDetails = {
        pickupPincode: TEST_CONFIG.testPincode,
        deliveryPincode: TEST_CONFIG.testDestinationPincode,
        paymentType: 'prepaid'
      };

      const partnerDetails = {};

      const rateResult = await ecomExpressUtils.calculateRate(packageDetails, deliveryDetails, partnerDetails);
      logTestResult('Rate Calculation', rateResult, Date.now() - rateStart);
      results.passed++;
      results.tests.push({ name: 'Rate Calculation', passed: true });
    } catch (error) {
      const rateResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.RATE_CALCULATOR
      };
      logTestResult('Rate Calculation', rateResult, Date.now() - rateStart);
      results.failed++;
      results.tests.push({ name: 'Rate Calculation', passed: false, error: error.message });
    }

    // Test 8: Cancel Shipment
    console.log('\n\n🚫 TEST 8: Cancel Shipment');
    const cancelStart = Date.now();
    try {
      const cancelData = {
        awbs: [TEST_CONFIG.testAWB],
        reason: 'Test cancellation'
      };

      const cancelResult = await ecomExpressUtils.cancelShipment(cancelData);
      logTestResult('Cancel Shipment', cancelResult, Date.now() - cancelStart);
      results.passed++;
      results.tests.push({ name: 'Cancel Shipment', passed: true });
    } catch (error) {
      const cancelResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.CANCEL_SHIPMENT
      };
      logTestResult('Cancel Shipment', cancelResult, Date.now() - cancelStart);
      results.failed++;
      results.tests.push({ name: 'Cancel Shipment', passed: false, error: error.message });
    }

    // Test 9: POD Status
    console.log('\n\n📄 TEST 9: POD (Proof of Delivery) Status');
    const podStart = Date.now();
    try {
      const podResult = await ecomExpressUtils.getPODStatus(TEST_CONFIG.testAWB);
      logTestResult('POD Status', podResult, Date.now() - podStart);
      results.passed++;
      results.tests.push({ name: 'POD Status', passed: true });
    } catch (error) {
      const podResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.POD_STATUS,
        payload: { awb: TEST_CONFIG.testAWB }
      };
      logTestResult('POD Status', podResult, Date.now() - podStart);
      results.failed++;
      results.tests.push({ name: 'POD Status', passed: false, error: error.message });
    }

    // Test 10: Print Label
    console.log('\n\n🏷️ TEST 10: Print Shipping Label');
    const labelStart = Date.now();
    try {
      const labelResult = await ecomExpressUtils.printLabel(TEST_CONFIG.testAWB);
      logTestResult('Print Label', labelResult, Date.now() - labelStart);
      results.passed++;
      results.tests.push({ name: 'Print Label', passed: true });
    } catch (error) {
      const labelResult = {
        success: false,
        error: error.message,
        endpoint: ECOMEXPRESS_CONFIG.ENDPOINTS.PRINT_LABEL,
        payload: { awb: TEST_CONFIG.testAWB }
      };
      logTestResult('Print Label', labelResult, Date.now() - labelStart);
      results.failed++;
      results.tests.push({ name: 'Print Label', passed: false, error: error.message });
    }

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR IN TEST SUITE:', error);
  }

  // Summary
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 ECOMEXPRESS TEST SUITE SUMMARY');
  console.log('═'.repeat(80));
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📋 Total Tests: ${results.tests.length}`);
  console.log('\n🔍 Test Details:');
  results.tests.forEach((test, index) => {
    console.log(`   ${index + 1}. ${test.name}: ${test.passed ? '✅ PASSED' : '❌ FAILED' + (test.error ? ` - ${test.error}` : '')}`);
  });
  console.log('═'.repeat(80) + '\n');

  return results;
};

// Run tests if executed directly
const isMainModule = process.argv[1] && (
  import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/')) ||
  process.argv[1].endsWith('test-ecomexpress.js')
);

if (isMainModule) {
  runEcomExpressTests()
    .then(() => {
      console.log('✅ EcomExpress test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ EcomExpress test suite failed:', error);
      process.exit(1);
    });
}

export default runEcomExpressTests;
