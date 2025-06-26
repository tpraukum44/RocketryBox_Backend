# Delivery Partner Test Suite

This comprehensive test suite validates the integration of all 5 delivery partners (BlueDart, EcomExpress, Ekart, Delhivery, and XpressBees) in the RocketryBox system.

## 📋 Overview

The test suite includes individual test scripts for each delivery partner that validate:
- Authentication mechanisms
- API endpoint connectivity
- Request/Response payload formats
- Service availability checks
- Shipment creation and tracking
- Rate calculations
- Label and manifest generation
- Cancellation workflows

## 🚀 Quick Start

### Prerequisites
- Node.js installed
- Backend dependencies installed (`npm install`)
- Valid API credentials configured in `.env` file

### Running Tests

#### Using PowerShell Script (Recommended)

From the backend directory:

```powershell
.\tests\delivery-partners\run-tests.ps1
```

This will display an interactive menu to:
1. Run all delivery partner tests
2. Run individual partner tests
3. View results in real-time

#### Direct Command Line Execution

Run all tests:
```bash
node tests/delivery-partners/run-all-tests.js
```

Run individual partner tests:
```bash
node tests/delivery-partners/test-bluedart.js
node tests/delivery-partners/test-ecomexpress.js
node tests/delivery-partners/test-ekart.js
node tests/delivery-partners/test-delhivery.js
node tests/delivery-partners/test-xpressbees.js
```

#### CI/CD Integration

For automated testing:
```powershell
.\tests\delivery-partners\run-tests.ps1 -Direct -Partner "all"
```

Or for specific partners:
```powershell
.\tests\delivery-partners\run-tests.ps1 -Direct -Partner "bluedart"
```

## 📁 Test Structure

```
tests/delivery-partners/
├── test-bluedart.js      # BlueDart API tests
├── test-ecomexpress.js   # EcomExpress API tests
├── test-ekart.js         # Ekart API tests
├── test-delhivery.js     # Delhivery API tests
├── test-xpressbees.js    # XpressBees API tests
├── run-all-tests.js      # Master test runner
├── run-tests.ps1         # PowerShell test runner
└── README.md             # This file
```

## 🧪 Test Coverage

### BlueDart Tests
1. JWT Token Generation
2. Location Finder (Pincode Serviceability)
3. Transit Time Calculation
4. Pickup Registration
5. E-Way Bill Generation
6. Shipment Tracking
7. Services for Product
8. Rate Calculation

### EcomExpress Tests
1. Authentication Check
2. Pincode Serviceability
3. AWB Number Generation
4. Shipment Booking
5. Shipment Tracking
6. Transit Time Calculation
7. Rate Calculation
8. Cancel Shipment
9. POD Status
10. Print Label

### Ekart Tests
1. Authentication Token Generation
2. Serviceability Check
3. Create Order/Shipment
4. Track Shipment
5. Cancel Order
6. Get Pickup Locations
7. Get Shipping Label
8. Get Manifest
9. Update Order
10. Get Order Status

### Delhivery Tests
1. Pincode Serviceability Check
2. Create Shipment/Order
3. Track Shipment
4. Generate Packing Slip
5. Cancel Shipment
6. Update Shipment
7. Get Warehouses
8. Generate Manifest
9. Rate Calculator
10. Pickup Request

### XpressBees Tests
1. JWT Token Generation
2. Pincode Serviceability Check
3. AWB Number Generation
4. Create Shipment
5. Track Shipment
6. Cancel Shipment
7. Print Shipping Label
8. Create Manifest
9. Schedule Pickup
10. Get Pickup Locations
11. Rate Calculator

## 📊 Understanding Test Results

Each test displays:
- **Status**: PASSED ✅ or FAILED ❌
- **Duration**: Time taken for the API call
- **Result**: Detailed response data
- **Error**: Error message if test failed

### Summary Report

The master test runner provides:
- Partner-wise results
- Overall statistics
- Success rate percentage
- Failed test details
- Total execution time

## 🔧 Configuration

Test data can be customized in each test file's `TEST_CONFIG` object:

```javascript
const TEST_CONFIG = {
  testPincode: '110001',
  testDestinationPincode: '400001',
  testAWB: 'TEST123456',
  // ... other configurations
};
```

## ⚠️ Important Notes

1. **API Credentials**: Ensure all delivery partner credentials are properly configured in the `.env` file
2. **Test Data**: The tests use sample data that may not generate actual shipments
3. **Rate Limits**: Be mindful of API rate limits when running tests repeatedly
4. **Network**: Ensure stable internet connection for API calls
5. **Environment**: Tests are configured to run against staging/sandbox environments by default

## 🐛 Troubleshooting

### Common Issues

1. **Authentication Failures**
   - Verify API credentials in `.env` file
   - Check if tokens have expired
   - Ensure API access is enabled for your account

2. **Network Errors**
   - Check internet connectivity
   - Verify firewall settings
   - Ensure API endpoints are accessible

3. **Test Failures**
   - Review error messages in test output
   - Check API documentation for payload changes
   - Verify test data is valid

### Debug Mode

To enable detailed logging, set in your environment:
```bash
DEBUG=true
```

## 📝 Adding New Tests

To add a new test to any partner:

1. Open the respective test file (e.g., `test-bluedart.js`)
2. Add a new test block following the pattern:

```javascript
// Test N: Your Test Name
console.log('\n\n📋 TEST N: Your Test Name');
const testStart = Date.now();
try {
  // Your test logic here
  const result = await someApiCall();
  logTestResult('Your Test Name', result, Date.now() - testStart);
  results.passed++;
  results.tests.push({ name: 'Your Test Name', passed: true });
} catch (error) {
  // Error handling
  results.failed++;
  results.tests.push({ name: 'Your Test Name', passed: false, error: error.message });
}
```

## 🤝 Contributing

When modifying tests:
1. Ensure all existing tests still pass
2. Add appropriate error handling
3. Update this README if adding new test categories
4. Follow the existing code style and patterns

## 📞 Support

For issues with:
- **Test Suite**: Contact the development team
- **API Issues**: Contact respective delivery partner support
- **Credentials**: Contact your account manager
