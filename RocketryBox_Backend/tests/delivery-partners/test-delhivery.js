import { DELHIVERY_CONFIG } from '../../src/config/delhivery.config.js';
import delhiveryService from '../../src/services/delhivery.service.js';
import * as delhiveryUtils from '../../src/utils/delhivery.js';

/**
 * Delhivery API Test Script
 * Tests all endpoints and payloads for Delhivery integration
 */

// Test configuration
const TEST_CONFIG = {
  // Test data
  testPincode: '110001', // Delhi
  testDestinationPincode: '400001', // Mumbai
  testAWB: 'DH123456789', // Example AWB number
  testClient: DELHIVERY_CONFIG.CLIENT_NAME || 'SURFACE-B2C',

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
    productType: 'cod', // cod or prepaid
    serviceType: 'express',
    packageType: 'documents',
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
const runDelhiveryTests = async () => {
  console.log('\n🚀 STARTING DELHIVERY API TEST SUITE\n');
  console.log('📌 Configuration Details:');
  console.log(`   API URL: ${DELHIVERY_CONFIG.BASE_URL}`);
  console.log(`   Client: ${DELHIVERY_CONFIG.CLIENT_NAME}`);
  console.log(`   Token Length: ${DELHIVERY_CONFIG.API_TOKEN ? DELHIVERY_CONFIG.API_TOKEN.length : 0}`);
  console.log(`   Environment: ${DELHIVERY_CONFIG.IS_PRODUCTION ? 'PRODUCTION' : 'STAGING'}`);

  const results = {
    passed: 0,
    failed: 0,
    tests: []
  };

  try {
    // Test 1: Pincode Serviceability
    console.log('\n\n📍 TEST 1: Pincode Serviceability Check');
    const serviceabilityStart = Date.now();
    try {
      const serviceabilityResult = await delhiveryUtils.checkPincodeServiceability(
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
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.PINCODE_SERVICE,
        payload: {
          origin: TEST_CONFIG.testPincode,
          destination: TEST_CONFIG.testDestinationPincode
        }
      };
      logTestResult('Pincode Serviceability', serviceabilityResult, Date.now() - serviceabilityStart);
      results.failed++;
      results.tests.push({ name: 'Pincode Serviceability', passed: false, error: error.message });
    }

    // Test 2: Create Shipment/Order
    console.log('\n\n📦 TEST 2: Create Shipment/Order');
    const createStart = Date.now();
    try {
      const shipmentData = {
        shipments: [{
          name: TEST_CONFIG.testCustomer.name,
          order: TEST_CONFIG.testShipment.orderNumber,
          products_desc: 'Test Product',
          order_date: new Date().toISOString(),
          payment_mode: TEST_CONFIG.testShipment.productType === 'cod' ? 'COD' : 'Prepaid',
          total_amount: TEST_CONFIG.testShipment.declaredValue,
          cod_amount: TEST_CONFIG.testShipment.productType === 'cod' ? TEST_CONFIG.testShipment.declaredValue : '0',
          add: TEST_CONFIG.testCustomer.address.line1 + ' ' + TEST_CONFIG.testCustomer.address.line2,
          city: TEST_CONFIG.testCustomer.address.city,
          state: TEST_CONFIG.testCustomer.address.state,
          country: TEST_CONFIG.testCustomer.address.country,
          phone: TEST_CONFIG.testCustomer.phone,
          pin: TEST_CONFIG.testDestinationPincode,
          return_pin: TEST_CONFIG.testPincode,
          return_city: 'New Delhi',
          return_phone: TEST_CONFIG.testCustomer.phone,
          return_add: TEST_CONFIG.testCustomer.address.line1,
          return_state: 'Delhi',
          return_country: 'India',
          return_name: 'Returns',
          vendor_pickup_location: '',
          quantity: TEST_CONFIG.testShipment.numberOfPieces,
          weight: TEST_CONFIG.testShipment.weight,
          length: TEST_CONFIG.testShipment.length,
          breadth: TEST_CONFIG.testShipment.width,
          height: TEST_CONFIG.testShipment.height,
          seller_inv: TEST_CONFIG.testShipment.invoiceNumber,
          seller_inv_date: new Date().toISOString().split('T')[0],
          fragile_shipment: false,
          dangerous_good: false
        }],
        pickup_location: {
          name: DELHIVERY_CONFIG.CLIENT_NAME,
          add: TEST_CONFIG.testCustomer.address.line1,
          city: 'New Delhi',
          pin_code: TEST_CONFIG.testPincode,
          phone: TEST_CONFIG.testCustomer.phone
        }
      };

      const createResult = await delhiveryService.createOrder(shipmentData);
      logTestResult('Create Shipment', createResult, Date.now() - createStart);
      results.passed++;
      results.tests.push({ name: 'Create Shipment', passed: true });
    } catch (error) {
      const createResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.CREATE_ORDER
      };
      logTestResult('Create Shipment', createResult, Date.now() - createStart);
      results.failed++;
      results.tests.push({ name: 'Create Shipment', passed: false, error: error.message });
    }

    // Test 3: Track Shipment
    console.log('\n\n🔍 TEST 3: Track Shipment');
    const trackingStart = Date.now();
    try {
      const trackingResult = await delhiveryService.trackShipment(TEST_CONFIG.testAWB);
      logTestResult('Track Shipment', trackingResult, Date.now() - trackingStart);
      results.passed++;
      results.tests.push({ name: 'Track Shipment', passed: true });
    } catch (error) {
      const trackingResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.TRACK,
        payload: { awb: TEST_CONFIG.testAWB }
      };
      logTestResult('Track Shipment', trackingResult, Date.now() - trackingStart);
      results.failed++;
      results.tests.push({ name: 'Track Shipment', passed: false, error: error.message });
    }

    // Test 4: Generate Packing Slip
    console.log('\n\n📄 TEST 4: Generate Packing Slip');
    const packingSlipStart = Date.now();
    try {
      const packingSlipResult = await delhiveryUtils.generatePackingSlip(TEST_CONFIG.testAWB);
      logTestResult('Generate Packing Slip', packingSlipResult, Date.now() - packingSlipStart);
      results.passed++;
      results.tests.push({ name: 'Generate Packing Slip', passed: true });
    } catch (error) {
      const packingSlipResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.PACKING_SLIP
      };
      logTestResult('Generate Packing Slip', packingSlipResult, Date.now() - packingSlipStart);
      results.failed++;
      results.tests.push({ name: 'Generate Packing Slip', passed: false, error: error.message });
    }

    // Test 5: Cancel Shipment
    console.log('\n\n🚫 TEST 5: Cancel Shipment');
    const cancelStart = Date.now();
    try {
      const cancelResult = await delhiveryUtils.cancelShipment(TEST_CONFIG.testAWB);
      logTestResult('Cancel Shipment', cancelResult, Date.now() - cancelStart);
      results.passed++;
      results.tests.push({ name: 'Cancel Shipment', passed: true });
    } catch (error) {
      const cancelResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.CANCEL_ORDER
      };
      logTestResult('Cancel Shipment', cancelResult, Date.now() - cancelStart);
      results.failed++;
      results.tests.push({ name: 'Cancel Shipment', passed: false, error: error.message });
    }

    // Test 6: Update Shipment
    console.log('\n\n📝 TEST 6: Update Shipment');
    const updateStart = Date.now();
    try {
      const updateData = {
        name: 'Updated Customer Name',
        phone: '8888888888',
        add: 'Updated Address'
      };

      const updateResult = await delhiveryUtils.updateShipment(TEST_CONFIG.testAWB, updateData);
      logTestResult('Update Shipment', updateResult, Date.now() - updateStart);
      results.passed++;
      results.tests.push({ name: 'Update Shipment', passed: true });
    } catch (error) {
      const updateResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.UPDATE_ORDER
      };
      logTestResult('Update Shipment', updateResult, Date.now() - updateStart);
      results.failed++;
      results.tests.push({ name: 'Update Shipment', passed: false, error: error.message });
    }

    // Test 7: Get Warehouses
    console.log('\n\n🏭 TEST 7: Get Warehouses');
    const warehouseStart = Date.now();
    try {
      const warehouseResult = await delhiveryUtils.getWarehouses();
      logTestResult('Get Warehouses', warehouseResult, Date.now() - warehouseStart);
      results.passed++;
      results.tests.push({ name: 'Get Warehouses', passed: true });
    } catch (error) {
      const warehouseResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.WAREHOUSES
      };
      logTestResult('Get Warehouses', warehouseResult, Date.now() - warehouseStart);
      results.failed++;
      results.tests.push({ name: 'Get Warehouses', passed: false, error: error.message });
    }

    // Test 8: Generate Manifest
    console.log('\n\n📄 TEST 8: Generate Manifest');
    const manifestStart = Date.now();
    try {
      const manifestResult = await delhiveryUtils.generateManifest([TEST_CONFIG.testAWB]);
      logTestResult('Generate Manifest', manifestResult, Date.now() - manifestStart);
      results.passed++;
      results.tests.push({ name: 'Generate Manifest', passed: true });
    } catch (error) {
      const manifestResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.MANIFEST
      };
      logTestResult('Generate Manifest', manifestResult, Date.now() - manifestStart);
      results.failed++;
      results.tests.push({ name: 'Generate Manifest', passed: false, error: error.message });
    }

    // Test 9: Rate Calculator
    console.log('\n\n💰 TEST 9: Rate Calculator');
    const rateStart = Date.now();
    try {
      const packageDetails = {
        weight: TEST_CONFIG.testShipment.weight / 1000, // Convert to kg
        dimensions: {
          length: TEST_CONFIG.testShipment.length,
          width: TEST_CONFIG.testShipment.width,
          height: TEST_CONFIG.testShipment.height
        }
      };

      const deliveryDetails = {
        pickupPincode: TEST_CONFIG.testPincode,
        deliveryPincode: TEST_CONFIG.testDestinationPincode,
        paymentType: TEST_CONFIG.testShipment.productType,
        codAmount: TEST_CONFIG.testShipment.productType === 'cod' ? TEST_CONFIG.testShipment.declaredValue : 0
      };

      const rateResult = await delhiveryUtils.calculateRate(packageDetails, deliveryDetails, {});
      logTestResult('Rate Calculator', rateResult, Date.now() - rateStart);
      results.passed++;
      results.tests.push({ name: 'Rate Calculator', passed: true });
    } catch (error) {
      const rateResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.RATE_CALCULATOR
      };
      logTestResult('Rate Calculator', rateResult, Date.now() - rateStart);
      results.failed++;
      results.tests.push({ name: 'Rate Calculator', passed: false, error: error.message });
    }

    // Test 10: Pickup Request
    console.log('\n\n🚚 TEST 10: Pickup Request');
    const pickupStart = Date.now();
    try {
      const pickupData = {
        pickup_time: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        pickup_location: TEST_CONFIG.testClient,
        expected_package_count: 1
      };

      const pickupResult = await delhiveryUtils.requestPickup(pickupData);
      logTestResult('Pickup Request', pickupResult, Date.now() - pickupStart);
      results.passed++;
      results.tests.push({ name: 'Pickup Request', passed: true });
    } catch (error) {
      const pickupResult = {
        success: false,
        error: error.message,
        endpoint: DELHIVERY_CONFIG.ENDPOINTS.PICKUP_REQUEST
      };
      logTestResult('Pickup Request', pickupResult, Date.now() - pickupStart);
      results.failed++;
      results.tests.push({ name: 'Pickup Request', passed: false, error: error.message });
    }

  } catch (error) {
    console.error('\n❌ UNEXPECTED ERROR IN TEST SUITE:', error);
  }

  // Summary
  console.log('\n\n' + '═'.repeat(80));
  console.log('📊 DELHIVERY TEST SUITE SUMMARY');
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
  process.argv[1].endsWith('test-delhivery.js')
);

if (isMainModule) {
  runDelhiveryTests()
    .then(() => {
      console.log('✅ Delhivery test suite completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Delhivery test suite failed:', error);
      process.exit(1);
    });
}

export default runDelhiveryTests;
