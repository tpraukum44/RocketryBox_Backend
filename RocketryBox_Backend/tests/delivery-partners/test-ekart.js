import { EKART_CONFIG } from '../../src/config/ekart.config.js';
import ekartService from '../../src/services/ekart.service.js';
import * as ekartUtils from '../../src/utils/ekart.js';

/**
 * Ekart API Test Script
 * Tests all endpoints and payloads for Ekart integration
 */

// Test configuration
const TEST_CONFIG = {
  // Test data
  testPincode: '560001', // Bangalore
  testDestinationPincode: '110001', // Delhi
  testAWB: 'EK123456789', // Example AWB number
  testPickupLocation: 'TEST_LOCATION',

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
    weight: 500, // grams
    length: 10,
    width: 10,
    height: 10,
    numberOfPieces: 1,
    declaredValue: 1000,
    productType: 'FORWARD',
    serviceType: 'STANDARD',
    packageType: 'documents',
    invoiceNumber: 'INV-' + Date.now(),
    sku: 'TEST-SKU-001'
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
const runEkartTests = async () => {
  console.log('\n🚀 STARTING EKART API TEST SUITE\n');
  console.log('📌 Configuration Details:');
  console.log(`   API URL: ${EKART_CONFIG.BASE_URL}`);
  console.log(`   Email: ${EKART_CONFIG.EMAIL}`);
  console.log(`   Client ID: ${EKART_CONFIG.CLIENT_ID}`);
  console.log(`   Environment: ${EKART_CONFIG.IS_PRODUCTION ? 'PRODUCTION' : 'STAGING'}`);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Test 1: Authentication
    console.log('\n\n🔐 TEST 1: Authentication Token Generation');
    const authStart = Date.now();
    try {
      const authResult = await ekartUtils.getAuthToken();
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
        endpoint: EKART_CONFIG.ENDPOINTS.AUTHENTICATE
      };
      logTestResult('Authentication', authResult, Date.now() - authStart);
      results.failed++;
      results.tests.push({ name: 'Authentication', passed: false, error: error.message });
    }

    // Test 2: Serviceability Check
    console.log('\n\n📍 TEST 2: Serviceability Check');
    const serviceabilityStart = Date.now();
    try {
      const serviceabilityResult = await ekartUtils.checkServiceability(
        TEST_CONFIG.testPincode,
        TEST_CONFIG.testDestinationPincode
      );
      logTestResult('Serviceability Check', serviceabilityResult, Date.now() - serviceabilityStart);
      results.passed++;
      results.tests.push({ name: 'Serviceability Check', passed: true });
    } catch (error) {
      const serviceabilityResult = {
        success: false,
        error: error.message,
        endpoint: EKART_CONFIG.ENDPOINTS.SERVICEABILITY
      };
      logTestResult('Serviceability Check', serviceabilityResult, Date.now() - serviceabilityStart);
      results.failed++;
      results.tests.push({ name: 'Serviceability Check', passed: false, error: error.message });
    }

    // Test 3: Create Order
    console.log('\n\n📦 TEST 3: Create Order/Shipment');
    const orderStart = Date.now();
    try {
      const orderData = {
        reference_number: 'ORD-' + Date.now(),
        courier_partner_reference_number: 'CP-' + Date.now(),
        products: [{
          sku: TEST_CONFIG.testShipment.sku,
          name: 'Test Product',
          qty: 1,
          price: TEST_CONFIG.testShipment.declaredValue,
          weight: TEST_CONFIG.testShipment.weight,
          product_url: 'https://example.com/product',
          product_image_url: 'https://example.com/product.jpg'
        }],
        consignee: {
          name: TEST_CONFIG.testCustomer.name,
          phone_number: TEST_CONFIG.testCustomer.phone,
          email_id: TEST_CONFIG.testCustomer.email,
          complete_address: TEST_CONFIG.testCustomer.address.line1 + ' ' + TEST_CONFIG.testCustomer.address.line2,
          pincode: TEST_CONFIG.testDestinationPincode,
          city: TEST_CONFIG.testCustomer.address.city,
          state: TEST_CONFIG.testCustomer.address.state
        },
        pickup_location: TEST_CONFIG.testPickupLocation,
        shipping_type: TEST_CONFIG.testShipment.productType,
        order_type: 'PREPAID',
        payment_type: 'PREPAID',
        initiated_by: 'merchant',
        invoice_number: TEST_CONFIG.testShipment.invoiceNumber,
        invoice_date: new Date().toISOString(),
        invoice_amount: TEST_CONFIG.testShipment.declaredValue,
        cgst: 0,
        sgst: 0,
        igst: 0,
        total_discount: 0,
        shipping_charges: 0,
        gift_wrap_charges: 0,
        transaction_charges: 0,
        total_charges: TEST_CONFIG.testShipment.declaredValue,
        seller_gst_number: '',
        customer_gst_number: '',
        is_insurance: false,
        tags: {}
      };

      const orderResult = await ekartService.createOrder(orderData);
      logTestResult('Create Order', orderResult, Date.now() - orderStart);
      results.passed++;
      results.tests.push({ name: 'Create Order', passed: true });
    } catch (error) {
      const orderResult = {
        success: false,
        error: error.message,
        endpoint: EKART_CONFIG.ENDPOINTS.CREATE_ORDER
      };
      logTestResult('Create Order', orderResult, Date.now() - orderStart);
      results.failed++;
      results.tests.push({ name: 'Create Order', passed: false, error: error.message });
    }

    // Test 4: Track Shipment
    console.log('\n\n🔍 TEST 4: Track Shipment');
    const trackingStart = Date.now();
    try {
      const trackingResult = await ekartService.trackShipment(TEST_CONFIG.testAWB);
      logTestResult('Track Shipment', trackingResult, Date.now() - trackingStart);
      results.passed++;
      results.tests.push({ name: 'Track Shipment', passed: true });
    } catch (error) {
      const trackingResult = {
        success: false,
        error: error.message,
        endpoint: EKART_CONFIG.ENDPOINTS.TRACK_ORDER,
        payload: { awb: TEST_CONFIG.testAWB }
      };
      logTestResult('Track Shipment', trackingResult, Date.now() - trackingStart);
      results.failed++;
      results.tests.push({ name: 'Track Shipment', passed: false, error: error.message });
    }

    // Test 5: Cancel Order
    console.log('\n\n🚫 TEST 5: Cancel Order');
    const cancelStart = Date.now();
    try {
      const cancelResult = await ekartUtils.cancelOrder(TEST_CONFIG.testAWB);
      logTestResult('Cancel Order', cancelResult, Date.now() - cancelStart);
      results.passed++;
      results.tests.push({ name: 'Cancel Order', passed: true });
    } catch (error) {
      const cancelResult = {
        success: false,
        error: error.message,
        endpoint: EKART_CONFIG.ENDPOINTS.CANCEL_ORDER
      };
      logTestResult('Cancel Order', cancelResult, Date.now() - cancelStart);
      results.failed++;
      results.tests.push({ name: 'Cancel Order', passed: false, error: error.message });
    }

    // Test 6: Get Pickup Locations
    console.log('\n\n📍 TEST 6: Get Pickup Locations');
    const pickupLocationsStart = Date.now();
    try {
      const pickupLocationsResult = await ekartUtils.getPickupLocations();
      logTestResult('Get Pickup Locations', pickupLocationsResult, Date.now() - pickupLocationsStart);
      results.passed++;
      results.tests.push({ name: 'Get Pickup Locations', passed: true });
    } catch (error) {
      const pickupLocationsResult = {
        success: false,
        error: error.message,
        endpoint: EKART_CONFIG.ENDPOINTS.PICKUP_LOCATIONS
      };
      logTestResult('Get Pickup Locations', pickupLocationsResult, Date.now() - pickupLocationsStart);
      results.failed++;
      results.tests.push({ name: 'Get Pickup Locations', passed: false, error: error.message });
    }

    // Test 7: Get Shipping Label
    console.log('\n\n🏷️ TEST 7: Get Shipping Label');
    const labelStart = Date.now();
    try {
      const labelResult = await ekartUtils.getShippingLabel(TEST_CONFIG.testAWB);
      logTestResult('Get Shipping Label', labelResult, Date.now() - labelStart);
      results.passed++;
      results.tests.push({ name: 'Get Shipping Label', passed: true });
    } catch (error) {
      const labelResult = {
        success: false,
        error: error.message,
        endpoint: EKART_CONFIG.ENDPOINTS.PRINT_LABEL
      };
      logTestResult('Get Shipping Label', labelResult, Date.now() - labelStart);
      results.failed++;
      results.tests.push({ name: 'Get Shipping Label', passed: false, error: error.message });
    }

    // Test 8: Get Manifest
    console.log('\n\n📄 TEST 8: Get Manifest');
    const manifestStart = Date.now();
    try {
      const manifestResult = await ekartUtils.getManifest(TEST_CONFIG.testAWB);
      logTestResult('Get Manifest', manifestResult, Date.now() - manifestStart);
      results.passed++;
      results.tests.push({ name: 'Get Manifest', passed: true });
    } catch (error) {
      const manifestResult = {
        success: false,
        error: error.message,
        endpoint: '/data/v2/generate/manifest'
      };
      logTestResult('Get Manifest', manifestResult, Date.now() - manifestStart);
      results.failed++;
      results.tests.push({ name: 'Get Manifest', passed: false, error: error.message });
    }

    // Test 9: Update Order
    console.log('\n\n📝 TEST 9: Update Order');
    const updateStart = Date.now();
    try {
      const updateData = {
        phone_number: '8888888888',
        email: 'updated@example.com'
      };

      const updateResult = await ekartUtils.updateOrder(TEST_CONFIG.testAWB, updateData);
      logTestResult('Update Order', updateResult, Date.now() - updateStart);
      results.passed++;
      results.tests.push({ name: 'Update Order', passed: true });
    } catch (error) {
      const updateResult = {
        success: false,
        error: error.message,
        endpoint: EKART_CONFIG.ENDPOINTS.UPDATE_ORDER
      };
      logTestResult('Update Order', updateResult, Date.now() - updateStart);
      results.failed++;
      results.tests.push({ name: 'Update Order', passed: false, error: error.message });
    }

    // Test 10: Get Order Status
    console.log('\n\n📊 TEST 10: Get Order Status');
    const statusStart = Date.now();
    try {
      const statusResult = await ekartUtils.getOrderStatus(TEST_CONFIG.testAWB);
      logTestResult('Get Order Status', statusResult, Date.now() - statusStart);
      results.passed++;
      results.tests.push({ name: 'Get Order Status', passed: true });
    } catch (error) {
      const statusResult = {
        success: false,
        error: error.message,
        endpoint: EKART_CONFIG.ENDPOINTS.TRACK_ORDER
      };
      logTestResult('Get Order Status', statusResult, Date.now() - statusStart);
      results.failed++;
      results.tests.push({ name: 'Get Order Status', passed: false, error: error.message });
    }

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR IN TEST SUITE:', error);
  }

  // Summary
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 EKART TEST SUITE SUMMARY');
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
  process.argv[1].endsWith('test-ekart.js')
);

if (isMainModule) {
  runEkartTests()
    .then(() => {
      console.log('✅ Ekart test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Ekart test suite failed:', error);
      process.exit(1);
    });
}

export default runEkartTests;
