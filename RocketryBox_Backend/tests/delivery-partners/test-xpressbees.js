import { XPRESSBEES_CONFIG } from '../../src/config/xpressbees.config.js';
import xpressbeesService from '../../src/services/xpressbees.service.js';
import * as xpressbeesUtils from '../../src/utils/xpressbees.js';

/**
 * XpressBees API Test Script
 * Tests all endpoints and payloads for XpressBees integration
 */

// Test configuration
const TEST_CONFIG = {
  // Test data
  testPincode: '110001', // Delhi
  testDestinationPincode: '400001', // Mumbai
  testAWB: 'XB123456789', // Example AWB number

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
    weight: 0.5, // kg
    length: 10,
    width: 10,
    height: 10,
    numberOfPieces: 1,
    declaredValue: 1000,
    productType: 'prepaid', // prepaid or cod
    serviceType: 'express',
    packageType: 'document',
    invoiceNumber: 'INV-' + Date.now(),
    orderNumber: 'ORD-' + Date.now()
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
const runXpressbeesTests = async () => {
  console.log('\n🚀 STARTING XPRESSBEES API TEST SUITE\n');
  console.log('📌 Configuration Details:');
  console.log(`   API URL: ${XPRESSBEES_CONFIG.BASE_URL}`);
  console.log(`   Email: ${XPRESSBEES_CONFIG.EMAIL}`);
  console.log(`   Customer ID: ${XPRESSBEES_CONFIG.CUSTOMER_ID}`);
  console.log(`   Environment: ${XPRESSBEES_CONFIG.IS_PRODUCTION ? 'PRODUCTION' : 'STAGING'}`);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Test 1: Authentication
    console.log('\n\n🔐 TEST 1: JWT Token Generation');
    const authStart = Date.now();
    try {
      const authResult = await xpressbeesUtils.getAuthToken();
      const testResult = {
        success: true,
        message: 'Authentication successful',
        tokenLength: authResult.token ? authResult.token.length : 0,
        tokenPreview: authResult.token ? authResult.token.substring(0, 20) + '...' : 'No token'
      };
      logTestResult('Authentication', testResult, Date.now() - authStart);
      results.passed++;
      results.tests.push({ name: 'Authentication', passed: true });
    } catch (error) {
      const authResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.AUTHENTICATE
      };
      logTestResult('Authentication', authResult, Date.now() - authStart);
      results.failed++;
      results.tests.push({ name: 'Authentication', passed: false, error: error.message });
    }

    // Test 2: Pincode Serviceability
    console.log('\n\n📍 TEST 2: Pincode Serviceability Check');
    const serviceabilityStart = Date.now();
    try {
      const serviceabilityResult = await xpressbeesUtils.checkPincodeServiceability(
        TEST_CONFIG.testPincode,
        TEST_CONFIG.testDestinationPincode
      );
      logTestResult('Pincode Serviceability', serviceabilityResult, Date.now() - serviceabilityStart);
      results.passed++;
      results.tests.push({ name: 'Pincode Serviceability', passed: true });
    } catch (error) {
      const serviceabilityResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.SERVICEABILITY
      };
      logTestResult('Pincode Serviceability', serviceabilityResult, Date.now() - serviceabilityStart);
      results.failed++;
      results.tests.push({ name: 'Pincode Serviceability', passed: false, error: error.message });
    }

    // Test 3: AWB Generation
    console.log('\n\n📄 TEST 3: AWB Number Generation');
    const awbStart = Date.now();
    try {
      const awbResult = await xpressbeesUtils.generateAWB();
      logTestResult('AWB Generation', awbResult, Date.now() - awbStart);
      results.passed++;
      results.tests.push({ name: 'AWB Generation', passed: true });
    } catch (error) {
      const awbResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.GENERATE_AWB
      };
      logTestResult('AWB Generation', awbResult, Date.now() - awbStart);
      results.failed++;
      results.tests.push({ name: 'AWB Generation', passed: false, error: error.message });
    }

    // Test 4: Create Shipment
    console.log('\n\n📦 TEST 4: Create Shipment');
    const createStart = Date.now();
    try {
      const shipmentData = {
        order_number: TEST_CONFIG.testShipment.orderNumber,
        delivery_type: TEST_CONFIG.testShipment.serviceType.toUpperCase(),
        courier_type: TEST_CONFIG.testShipment.packageType === 'document' ? 'ECONOMY_DOC' : 'ECONOMY',
        customer_reference_number: TEST_CONFIG.testShipment.orderNumber,
        invoice_number: TEST_CONFIG.testShipment.invoiceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_amount: TEST_CONFIG.testShipment.declaredValue,
        collectable_amount: TEST_CONFIG.testShipment.productType === 'cod' ? TEST_CONFIG.testShipment.declaredValue : 0,
        eway_bill_number: '',
        consignee_name: TEST_CONFIG.testCustomer.name,
        consignee_phone: TEST_CONFIG.testCustomer.phone,
        consignee_email: TEST_CONFIG.testCustomer.email,
        consignee_address: TEST_CONFIG.testCustomer.address.line1,
        consignee_address2: TEST_CONFIG.testCustomer.address.line2,
        consignee_address3: TEST_CONFIG.testCustomer.address.line3,
        consignee_pincode: TEST_CONFIG.testDestinationPincode,
        consignee_city: TEST_CONFIG.testCustomer.address.city,
        consignee_state: TEST_CONFIG.testCustomer.address.state,
        product_details: [{
          product_name: 'Test Product',
          product_quantity: 1,
          product_price: TEST_CONFIG.testShipment.declaredValue,
          product_sku: 'TEST-SKU-001'
        }],
        total_weight: TEST_CONFIG.testShipment.weight,
        packageList: [{
          pack_weight: TEST_CONFIG.testShipment.weight,
          pack_length: TEST_CONFIG.testShipment.length,
          pack_width: TEST_CONFIG.testShipment.width,
          pack_height: TEST_CONFIG.testShipment.height,
          pack_volumetric_weight: (TEST_CONFIG.testShipment.length * TEST_CONFIG.testShipment.width * TEST_CONFIG.testShipment.height) / 5000
        }]
      };

      const createResult = await xpressbeesService.createOrder(shipmentData);
      logTestResult('Create Shipment', createResult, Date.now() - createStart);
      results.passed++;
      results.tests.push({ name: 'Create Shipment', passed: true });
    } catch (error) {
      const createResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.CREATE_SHIPMENT
      };
      logTestResult('Create Shipment', createResult, Date.now() - createStart);
      results.failed++;
      results.tests.push({ name: 'Create Shipment', passed: false, error: error.message });
    }

    // Test 5: Track Shipment
    console.log('\n\n🔍 TEST 5: Track Shipment');
    const trackingStart = Date.now();
    try {
      const trackingResult = await xpressbeesService.trackShipment(TEST_CONFIG.testAWB);
      logTestResult('Track Shipment', trackingResult, Date.now() - trackingStart);
      results.passed++;
      results.tests.push({ name: 'Track Shipment', passed: true });
    } catch (error) {
      const trackingResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.TRACK,
        payload: { awb: TEST_CONFIG.testAWB }
      };
      logTestResult('Track Shipment', trackingResult, Date.now() - trackingStart);
      results.failed++;
      results.tests.push({ name: 'Track Shipment', passed: false, error: error.message });
    }

    // Test 6: Cancel Shipment
    console.log('\n\n🚫 TEST 6: Cancel Shipment');
    const cancelStart = Date.now();
    try {
      const cancelResult = await xpressbeesUtils.cancelShipment(TEST_CONFIG.testAWB);
      logTestResult('Cancel Shipment', cancelResult, Date.now() - cancelStart);
      results.passed++;
      results.tests.push({ name: 'Cancel Shipment', passed: true });
    } catch (error) {
      const cancelResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.CANCEL_SHIPMENT
      };
      logTestResult('Cancel Shipment', cancelResult, Date.now() - cancelStart);
      results.failed++;
      results.tests.push({ name: 'Cancel Shipment', passed: false, error: error.message });
    }

    // Test 7: Print Label
    console.log('\n\n🏷️ TEST 7: Print Shipping Label');
    const labelStart = Date.now();
    try {
      const labelResult = await xpressbeesUtils.getShippingLabel(TEST_CONFIG.testAWB);
      logTestResult('Print Label', labelResult, Date.now() - labelStart);
      results.passed++;
      results.tests.push({ name: 'Print Label', passed: true });
    } catch (error) {
      const labelResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.PRINT_LABEL
      };
      logTestResult('Print Label', labelResult, Date.now() - labelStart);
      results.failed++;
      results.tests.push({ name: 'Print Label', passed: false, error: error.message });
    }

    // Test 8: Create Manifest
    console.log('\n\n📄 TEST 8: Create Manifest');
    const manifestStart = Date.now();
    try {
      const manifestResult = await xpressbeesUtils.getManifest([TEST_CONFIG.testAWB]);
      logTestResult('Create Manifest', manifestResult, Date.now() - manifestStart);
      results.passed++;
      results.tests.push({ name: 'Create Manifest', passed: true });
    } catch (error) {
      const manifestResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.CREATE_MANIFEST
      };
      logTestResult('Create Manifest', manifestResult, Date.now() - manifestStart);
      results.failed++;
      results.tests.push({ name: 'Create Manifest', passed: false, error: error.message });
    }

    // Test 9: Schedule Pickup
    console.log('\n\n🚚 TEST 9: Schedule Pickup');
    const pickupStart = Date.now();
    try {
      const pickupResult = await xpressbeesUtils.requestPickup([TEST_CONFIG.testAWB]);
      logTestResult('Schedule Pickup', pickupResult, Date.now() - pickupStart);
      results.passed++;
      results.tests.push({ name: 'Schedule Pickup', passed: true });
    } catch (error) {
      const pickupResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.SCHEDULE_PICKUP
      };
      logTestResult('Schedule Pickup', pickupResult, Date.now() - pickupStart);
      results.failed++;
      results.tests.push({ name: 'Schedule Pickup', passed: false, error: error.message });
    }

    // Test 10: Get Pickup Locations
    console.log('\n\n📍 TEST 10: Get Pickup Locations');
    const locationsStart = Date.now();
    try {
      const locationsResult = await xpressbeesUtils.getPickupLocations();
      logTestResult('Get Pickup Locations', locationsResult, Date.now() - locationsStart);
      results.passed++;
      results.tests.push({ name: 'Get Pickup Locations', passed: true });
    } catch (error) {
      const locationsResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.PICKUP_LOCATIONS
      };
      logTestResult('Get Pickup Locations', locationsResult, Date.now() - locationsStart);
      results.failed++;
      results.tests.push({ name: 'Get Pickup Locations', passed: false, error: error.message });
    }

    // Test 11: Rate Calculator
    console.log('\n\n💰 TEST 11: Rate Calculator');
    const rateStart = Date.now();
    try {
      const packageDetails = {
        weight: TEST_CONFIG.testShipment.weight,
        dimensions: {
          length: TEST_CONFIG.testShipment.length,
          width: TEST_CONFIG.testShipment.width,
          height: TEST_CONFIG.testShipment.height
        },
        cod: TEST_CONFIG.testShipment.productType === 'cod',
        serviceType: TEST_CONFIG.testShipment.serviceType
      };

      const deliveryDetails = {
        pickupPincode: TEST_CONFIG.testPincode,
        deliveryPincode: TEST_CONFIG.testDestinationPincode,
        paymentType: TEST_CONFIG.testShipment.productType,
        codAmount: TEST_CONFIG.testShipment.productType === 'cod' ? TEST_CONFIG.testShipment.declaredValue : 0
      };

      const rateResult = await xpressbeesUtils.calculateRate(packageDetails, deliveryDetails, {});
      logTestResult('Rate Calculator', rateResult, Date.now() - rateStart);
      results.passed++;
      results.tests.push({ name: 'Rate Calculator', passed: true });
    } catch (error) {
      const rateResult = {
        success: false,
        error: error.message,
        endpoint: XPRESSBEES_CONFIG.ENDPOINTS.RATE_CALCULATOR
      };
      logTestResult('Rate Calculator', rateResult, Date.now() - rateStart);
      results.failed++;
      results.tests.push({ name: 'Rate Calculator', passed: false, error: error.message });
    }

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR IN TEST SUITE:', error);
  }

  // Summary
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 XPRESSBEES TEST SUITE SUMMARY');
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
  process.argv[1].endsWith('test-xpressbees.js')
);

if (isMainModule) {
  runXpressbeesTests()
    .then(() => {
      console.log('✅ XpressBees test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ XpressBees test suite failed:', error);
      process.exit(1);
    });
}

export default runXpressbeesTests;
