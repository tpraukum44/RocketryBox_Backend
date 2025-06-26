import axios from 'axios';
import express from 'express';
import { BLUEDART_CONFIG } from '../../../config/bluedart.config.js';
import { DELHIVERY_CONFIG } from '../../../config/delhivery.config.js';
import { ECOMEXPRESS_CONFIG } from '../../../config/ecomexpress.config.js';
import { EKART_CONFIG } from '../../../config/ekart.config.js';
import { XPRESSBEES_CONFIG } from '../../../config/xpressbees.config.js';
import { authenticateToken } from '../../../middleware/auth.js';
import { authorizeRoles } from '../../../middleware/roleAuth.js';
import { logger } from '../../../utils/logger.js';

const router = express.Router();

/**
 * Get shipping integration status
 * Professional endpoint to monitor shipping partner API connectivity
 */
router.get('/status', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const status = {
      timestamp: new Date().toISOString(),
      bluedart: {
        configured: false,
        authenticated: false,
        apiEndpoint: BLUEDART_CONFIG.API_URL,
        authEndpoint: BLUEDART_CONFIG.AUTH_URL,
        lastChecked: new Date().toISOString(),
        error: null,
        details: {}
      },
      xpressbees: {
        configured: false,
        authenticated: false,
        apiEndpoint: XPRESSBEES_CONFIG.BASE_URL,
        lastChecked: new Date().toISOString(),
        error: null,
        details: {}
      },
      ecomexpress: {
        configured: false,
        authenticated: false,
        apiEndpoint: ECOMEXPRESS_CONFIG.API_BASE_URL,
        lastChecked: new Date().toISOString(),
        error: null,
        details: {}
      },
      ekart: {
        configured: false,
        authenticated: false,
        apiEndpoint: EKART_CONFIG.BASE_URL,
        lastChecked: new Date().toISOString(),
        error: null,
        details: {}
      }
    };

    // Check if BlueDart is configured
    if (BLUEDART_CONFIG.LICENSE_KEY && BLUEDART_CONFIG.USER) {
      status.bluedart.configured = true;
      status.bluedart.details = {
        hasLicenseKey: !!BLUEDART_CONFIG.LICENSE_KEY,
        hasUser: !!BLUEDART_CONFIG.USER,
        apiType: BLUEDART_CONFIG.API_TYPE,
        version: BLUEDART_CONFIG.VERSION
      };

      // Test authentication
      try {
        const authResponse = await axios.post(BLUEDART_CONFIG.AUTH_URL, {
          profile: {
            Api_type: BLUEDART_CONFIG.API_TYPE,
            LicenceKey: BLUEDART_CONFIG.LICENSE_KEY,
            LoginID: BLUEDART_CONFIG.USER
          }
        }, {
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 second timeout for status check
        });

        if (authResponse.data && (authResponse.data.token || authResponse.data.JWTToken || authResponse.data.access_token)) {
          status.bluedart.authenticated = true;
          status.bluedart.details.authResponseStatus = authResponse.status;
        } else {
          status.bluedart.error = 'Authentication successful but no token received';
          status.bluedart.details.authResponse = authResponse.data;
        }
      } catch (authError) {
        status.bluedart.error = authError.message;
        status.bluedart.details.authError = {
          status: authError.response?.status,
          statusText: authError.response?.statusText,
          data: authError.response?.data
        };
      }
    } else {
      status.bluedart.error = 'BlueDart API credentials not configured';
      status.bluedart.details = {
        hasLicenseKey: !!BLUEDART_CONFIG.LICENSE_KEY,
        hasUser: !!BLUEDART_CONFIG.USER,
        missingCredentials: [
          !BLUEDART_CONFIG.LICENSE_KEY && 'BLUEDART_LICENSE_KEY',
          !BLUEDART_CONFIG.USER && 'BLUEDART_USER'
        ].filter(Boolean)
      };
    }

    // Check if XpressBees is configured
    if (XPRESSBEES_CONFIG.EMAIL && XPRESSBEES_CONFIG.PASSWORD) {
      status.xpressbees.configured = true;
      status.xpressbees.details = {
        hasEmail: !!XPRESSBEES_CONFIG.EMAIL,
        hasPassword: !!XPRESSBEES_CONFIG.PASSWORD,
        baseUrl: XPRESSBEES_CONFIG.BASE_URL,
        availableServices: Object.keys(XPRESSBEES_CONFIG.SERVICE_TYPES)
      };

      // Test authentication
      try {
        const { authenticate } = await import('../../../utils/xpressbees.js');
        const token = await authenticate();

        if (token && token.length > 0) {
          status.xpressbees.authenticated = true;
          status.xpressbees.details.tokenLength = token.length;
        } else {
          status.xpressbees.error = 'Authentication successful but no token received';
        }
      } catch (authError) {
        status.xpressbees.error = authError.message;
        status.xpressbees.details.authError = {
          message: authError.message
        };
      }
    } else {
      status.xpressbees.error = 'XpressBees API credentials not configured';
      status.xpressbees.details = {
        hasEmail: !!XPRESSBEES_CONFIG.EMAIL,
        hasPassword: !!XPRESSBEES_CONFIG.PASSWORD,
        missingCredentials: [
          !XPRESSBEES_CONFIG.EMAIL && 'XPRESSBEES_EMAIL',
          !XPRESSBEES_CONFIG.PASSWORD && 'XPRESSBEES_PASSWORD'
        ].filter(Boolean)
      };
    }

    // Check if Ecom Express is configured
    const hasEcomExpressCredentials = ECOMEXPRESS_CONFIG.SHIPPERS.BA.USERNAME ||
      ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.USERNAME ||
      ECOMEXPRESS_CONFIG.SHIPPERS.EGS.USERNAME;

    if (hasEcomExpressCredentials) {
      status.ecomexpress.configured = true;
      status.ecomexpress.details = {
        hasBACredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.BA.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.BA.PASSWORD),
        hasEXSPLUSCredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.PASSWORD),
        hasEGSCredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.EGS.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.EGS.PASSWORD),
        baseUrl: ECOMEXPRESS_CONFIG.API_BASE_URL,
        availableServices: Object.keys(ECOMEXPRESS_CONFIG.SERVICES)
      };

      // Test authentication with the first available service
      try {
        const { checkPincodeServiceability } = await import('../../../utils/ecomexpress.js');
        const testResult = await checkPincodeServiceability('110001', 'standard');

        if (testResult && testResult.success) {
          status.ecomexpress.authenticated = true;
          status.ecomexpress.details.testPincode = '110001';
        } else {
          status.ecomexpress.error = 'API accessible but test failed';
        }
      } catch (authError) {
        status.ecomexpress.error = authError.message;
        status.ecomexpress.details.authError = {
          message: authError.message
        };
      }
    } else {
      status.ecomexpress.error = 'Ecom Express API credentials not configured';
      status.ecomexpress.details = {
        hasBACredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.BA.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.BA.PASSWORD),
        hasEXSPLUSCredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.PASSWORD),
        hasEGSCredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.EGS.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.EGS.PASSWORD),
        missingCredentials: [
          !ECOMEXPRESS_CONFIG.SHIPPERS.BA.USERNAME && 'ECOMEXPRESS_BA_USERNAME/PASSWORD',
          !ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.USERNAME && 'ECOMEXPRESS_EXSPLUS_USERNAME/PASSWORD',
          !ECOMEXPRESS_CONFIG.SHIPPERS.EGS.USERNAME && 'ECOMEXPRESS_EGS_USERNAME/PASSWORD'
        ].filter(Boolean)
      };
    }

    // Check if Ekart is configured
    if (EKART_CONFIG.BASE_URL) {
      status.ekart.configured = true;
      status.ekart.details = {
        baseUrl: EKART_CONFIG.BASE_URL,
        hasCredentials: !!(EKART_CONFIG.USERNAME && EKART_CONFIG.PASSWORD)
      };

      // Test authentication
      try {
        const { authenticate } = await import('../../../utils/ekart.js');
        const token = await authenticate();

        if (token && token.length > 0) {
          status.ekart.authenticated = true;
          status.ekart.details.tokenLength = token.length;
        } else {
          status.ekart.error = 'Authentication successful but no token received';
        }
      } catch (authError) {
        status.ekart.error = authError.message;
        status.ekart.details.authError = {
          message: authError.message
        };
      }
    } else {
      status.ekart.error = 'Ekart API credentials not configured';
      status.ekart.details = {
        missingCredentials: [
          !EKART_CONFIG.USERNAME && 'EKART_USERNAME',
          !EKART_CONFIG.PASSWORD && 'EKART_PASSWORD'
        ].filter(Boolean)
      };
    }

    res.json({
      success: true,
      data: status
    });

  } catch (error) {
    logger.error('Error checking shipping status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check shipping integration status',
      details: error.message
    });
  }
});

/**
 * Test BlueDart rate calculation
 * Professional endpoint to test BlueDart API functionality
 */
router.post('/test/bluedart/rates', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { pickupPincode = '110001', deliveryPincode = '400001', weight = 1 } = req.body;

    // Import BlueDart utility
    const { calculateRate } = await import('../../../utils/bluedart.js');

    const packageDetails = {
      weight: weight,
      dimensions: { length: 10, width: 10, height: 10 },
      serviceType: 'express',
      declaredValue: 100
    };

    const deliveryDetails = {
      pickupPincode,
      deliveryPincode
    };

    const result = await calculateRate(packageDetails, deliveryDetails, {});

    res.json({
      success: true,
      message: 'BlueDart rate calculation test successful',
      data: {
        testParameters: { pickupPincode, deliveryPincode, weight },
        result
      }
    });

  } catch (error) {
    logger.error('BlueDart rate calculation test failed:', error);
    res.status(400).json({
      success: false,
      error: 'BlueDart rate calculation test failed',
      details: {
        message: error.message,
        code: error.code,
        partner: error.partner,
        timestamp: error.timestamp,
        details: error.details
      }
    });
  }
});

/**
 * Get BlueDart configuration (sanitized)
 * Professional endpoint to view current BlueDart configuration
 */
router.get('/config/bluedart', authenticateToken, authorizeRoles(['admin', 'super_admin']), (req, res) => {
  try {
    const config = {
      apiUrl: BLUEDART_CONFIG.API_URL,
      authUrl: BLUEDART_CONFIG.AUTH_URL,
      apiType: BLUEDART_CONFIG.API_TYPE,
      version: BLUEDART_CONFIG.VERSION,
      hasLicenseKey: !!BLUEDART_CONFIG.LICENSE_KEY,
      hasUser: !!BLUEDART_CONFIG.USER,
      hasConsumerKey: !!BLUEDART_CONFIG.CONSUMER_KEY,
      hasConsumerSecret: !!BLUEDART_CONFIG.CONSUMER_SECRET,
      requestTimeout: BLUEDART_CONFIG.REQUEST_TIMEOUT,
      tokenExpiry: BLUEDART_CONFIG.TOKEN_EXPIRY,
      // Don't expose actual credentials
      userMasked: BLUEDART_CONFIG.USER ? BLUEDART_CONFIG.USER.substring(0, 3) + '***' : null,
      licenseKeyMasked: BLUEDART_CONFIG.LICENSE_KEY ? '***' + BLUEDART_CONFIG.LICENSE_KEY.slice(-4) : null
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Error getting BlueDart configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get BlueDart configuration',
      details: error.message
    });
  }
});

/**
 * Test XpressBees authentication
 * Professional endpoint to test XpressBees API functionality
 */
router.post('/test/xpressbees/auth', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import XpressBees utility
    const { authenticate } = await import('../../../utils/xpressbees.js');

    const result = await authenticate();

    res.json({
      success: true,
      message: 'XpressBees authentication test successful',
      data: {
        tokenLength: result.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('XpressBees authentication test failed:', error);
    res.status(400).json({
      success: false,
      error: 'XpressBees authentication test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test XpressBees courier list
 * Professional endpoint to test XpressBees API functionality
 */
router.get('/test/xpressbees/couriers', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import XpressBees utility
    const { getCourierList } = await import('../../../utils/xpressbees.js');

    const result = await getCourierList();

    res.json({
      success: true,
      message: 'XpressBees courier list test successful',
      data: {
        totalCouriers: result.couriers.length,
        couriers: result.couriers,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('XpressBees courier list test failed:', error);
    res.status(400).json({
      success: false,
      error: 'XpressBees courier list test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test XpressBees shipment booking
 * Professional endpoint to test XpressBees API functionality
 */
router.post('/test/xpressbees/booking', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import XpressBees service
    const xpressBeesService = (await import('../../../services/xpressbees.service.js')).default;

    // Create test shipment data
    const testShipmentData = {
      serviceType: 'standard',
      weight: 1,
      cod: true,
      declaredValue: 600,
      codAmount: 575,
      commodity: 'Test Product',
      dimensions: {
        length: 20,
        width: 15,
        height: 10
      },
      shipper: {
        name: 'RocketryBox Test',
        phone: '9999999999',
        address: {
          line1: 'Test Address, Test Area',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001'
        }
      },
      consignee: {
        name: 'Test Customer',
        phone: '8888888888',
        address: {
          line1: 'Test Delivery Address',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001'
        }
      }
    };

    const result = await xpressBeesService.bookShipment(testShipmentData);

    res.json({
      success: true,
      message: 'XpressBees booking test completed',
      data: {
        testParameters: testShipmentData,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('XpressBees booking test failed:', error);
    res.status(400).json({
      success: false,
      error: 'XpressBees booking test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test XpressBees shipment cancellation
 * Professional endpoint to test XpressBees API functionality
 */
router.post('/test/xpressbees/cancel', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { awb } = req.body;

    if (!awb) {
      return res.status(400).json({
        success: false,
        error: 'AWB number is required',
        timestamp: new Date().toISOString()
      });
    }

    // Import XpressBees utility
    const { cancelShipment } = await import('../../../utils/xpressbees.js');

    const result = await cancelShipment(awb);

    res.json({
      success: true,
      message: 'XpressBees cancellation test completed',
      data: {
        awb,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('XpressBees cancellation test failed:', error);
    res.status(400).json({
      success: false,
      error: 'XpressBees cancellation test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Run comprehensive XpressBees API tests
 * Professional endpoint to test all XpressBees API functionality
 */
router.get('/test/xpressbees/all', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import XpressBees utilities
    const { authenticate, getCourierList } = await import('../../../utils/xpressbees.js');
    const xpressBeesService = (await import('../../../services/xpressbees.service.js')).default;

    const testResults = {
      authentication: null,
      courierList: null,
      serviceHealth: null,
      summary: {
        total: 3,
        passed: 0,
        failed: 0,
        startTime: new Date().toISOString()
      }
    };

    // Test 1: Authentication
    try {
      await authenticate();
      testResults.authentication = { status: 'PASSED', message: 'Authentication successful' };
      testResults.summary.passed++;
    } catch (error) {
      testResults.authentication = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    // Test 2: Courier List
    try {
      const courierResult = await getCourierList();
      testResults.courierList = {
        status: 'PASSED',
        message: 'Courier list retrieved successfully',
        data: { totalCouriers: courierResult.couriers.length }
      };
      testResults.summary.passed++;
    } catch (error) {
      testResults.courierList = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    // Test 3: Service Health
    try {
      const healthStatus = await xpressBeesService.getHealthStatus();
      testResults.serviceHealth = {
        status: healthStatus.status === 'HEALTHY' ? 'PASSED' : 'FAILED',
        data: healthStatus
      };
      if (healthStatus.status === 'HEALTHY') {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    } catch (error) {
      testResults.serviceHealth = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    testResults.summary.endTime = new Date().toISOString();
    testResults.summary.passRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);

    const status = testResults.summary.failed === 0 ? 200 : 207; // 207 = Multi-Status

    res.status(status).json({
      success: testResults.summary.failed === 0,
      message: `XpressBees API tests completed - ${testResults.summary.passed}/${testResults.summary.total} passed`,
      data: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('XpressBees comprehensive test failed:', error);
    res.status(500).json({
      success: false,
      error: 'XpressBees comprehensive test execution failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Get XpressBees configuration (sanitized)
 * Professional endpoint to view current XpressBees configuration
 */
router.get('/config/xpressbees', authenticateToken, authorizeRoles(['admin', 'super_admin']), (req, res) => {
  try {
    const config = {
      baseUrl: XPRESSBEES_CONFIG.BASE_URL,
      apiEndpoints: Object.keys(XPRESSBEES_CONFIG.ENDPOINTS),
      serviceTypes: XPRESSBEES_CONFIG.SERVICE_TYPES,
      hasEmail: !!XPRESSBEES_CONFIG.EMAIL,
      hasPassword: !!XPRESSBEES_CONFIG.PASSWORD,
      requestTimeout: XPRESSBEES_CONFIG.REQUEST_TIMEOUT,
      // Don't expose actual credentials
      emailMasked: XPRESSBEES_CONFIG.EMAIL ? XPRESSBEES_CONFIG.EMAIL.substring(0, 3) + '***@' + XPRESSBEES_CONFIG.EMAIL.split('@')[1] : null
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Error getting XpressBees configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get XpressBees configuration',
      details: error.message
    });
  }
});

/**
 * Test Ecom Express pincode serviceability
 * Professional endpoint to test Ecom Express API functionality
 */
router.post('/test/ecomexpress/pincode', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { pincode = '110001', serviceType = 'standard' } = req.body;

    // Import Ecom Express utility
    const { checkPincodeServiceability } = await import('../../../utils/ecomexpress.js');

    const result = await checkPincodeServiceability(pincode, serviceType);

    res.json({
      success: true,
      message: 'Ecom Express pincode check test successful',
      data: {
        testParameters: { pincode, serviceType },
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ecom Express pincode check test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ecom Express pincode check test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ecom Express AWB fetch
 * Professional endpoint to test Ecom Express API functionality
 */
router.post('/test/ecomexpress/awb', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { serviceType = 'standard' } = req.body;

    // Import Ecom Express utility
    const { fetchAWB } = await import('../../../utils/ecomexpress.js');

    const testShipmentData = { serviceType };
    const result = await fetchAWB(testShipmentData, serviceType);

    res.json({
      success: true,
      message: 'Ecom Express AWB fetch test completed',
      data: {
        testParameters: { serviceType },
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ecom Express AWB fetch test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ecom Express AWB fetch test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ecom Express shipment booking
 * Professional endpoint to test Ecom Express API functionality
 */
router.post('/test/ecomexpress/booking', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import Ecom Express service
    const { EcomExpressService } = await import('../../../services/ecomexpress.service.js');
    const ecomExpressService = new EcomExpressService();

    // Create test shipment data
    const testShipmentData = {
      serviceType: 'standard',
      weight: 1,
      cod: true,
      declaredValue: 500,
      codAmount: 450,
      commodity: 'Test Product',
      invoiceNumber: `TEST${Date.now()}`,
      dimensions: {
        length: 20,
        width: 15,
        height: 10
      },
      shipper: {
        name: 'RocketryBox Test',
        phone: '9999999999',
        email: 'test@rocketrybox.in',
        address: {
          line1: 'Test Address, Test Area',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001'
        }
      },
      consignee: {
        name: 'Test Customer',
        phone: '8888888888',
        email: 'customer@test.com',
        address: {
          line1: 'Test Delivery Address',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001'
        }
      }
    };

    const result = await ecomExpressService.bookShipment(testShipmentData);

    res.json({
      success: true,
      message: 'Ecom Express booking test completed',
      data: {
        testParameters: testShipmentData,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ecom Express booking test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ecom Express booking test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ecom Express shipment tracking
 * Professional endpoint to test Ecom Express API functionality
 */
router.post('/test/ecomexpress/tracking', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { awb } = req.body;

    if (!awb) {
      return res.status(400).json({
        success: false,
        error: 'AWB number is required',
        timestamp: new Date().toISOString()
      });
    }

    // Import Ecom Express utility
    const { trackShipment } = await import('../../../utils/ecomexpress.js');

    const result = await trackShipment(awb);

    res.json({
      success: true,
      message: 'Ecom Express tracking test completed',
      data: {
        awb,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ecom Express tracking test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ecom Express tracking test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ecom Express shipment cancellation
 * Professional endpoint to test Ecom Express API functionality
 */
router.post('/test/ecomexpress/cancel', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { awb, serviceType = 'standard' } = req.body;

    if (!awb) {
      return res.status(400).json({
        success: false,
        error: 'AWB number is required',
        timestamp: new Date().toISOString()
      });
    }

    // Import Ecom Express utility
    const { cancelShipment } = await import('../../../utils/ecomexpress.js');

    const result = await cancelShipment(awb, serviceType);

    res.json({
      success: true,
      message: 'Ecom Express cancellation test completed',
      data: {
        awb,
        serviceType,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ecom Express cancellation test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ecom Express cancellation test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Run comprehensive Ecom Express API tests
 * Professional endpoint to test all Ecom Express API functionality
 */
router.get('/test/ecomexpress/all', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import Ecom Express utilities
    const { checkPincodeServiceability, fetchAWB } = await import('../../../utils/ecomexpress.js');
    const { EcomExpressService } = await import('../../../services/ecomexpress.service.js');
    const ecomExpressService = new EcomExpressService();

    const testResults = {
      pincodeCheck: null,
      awbFetch: null,
      serviceHealth: null,
      summary: {
        total: 3,
        passed: 0,
        failed: 0,
        startTime: new Date().toISOString()
      }
    };

    // Test 1: Pincode Serviceability
    try {
      const pincodeResult = await checkPincodeServiceability('110001', 'standard');
      testResults.pincodeCheck = {
        status: pincodeResult.success ? 'PASSED' : 'FAILED',
        message: 'Pincode serviceability check completed',
        data: { testPincode: '110001', serviceable: pincodeResult.serviceable }
      };
      if (pincodeResult.success) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    } catch (error) {
      testResults.pincodeCheck = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    // Test 2: AWB Fetch
    try {
      const awbResult = await fetchAWB({ serviceType: 'standard' }, 'standard');
      testResults.awbFetch = {
        status: awbResult.success ? 'PASSED' : 'FAILED',
        message: 'AWB fetch completed',
        data: { hasAWB: !!awbResult.awb }
      };
      if (awbResult.success) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    } catch (error) {
      testResults.awbFetch = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    // Test 3: Service Health Check
    try {
      // Use configuration validation as health check
      ECOMEXPRESS_CONFIG.validate();
      testResults.serviceHealth = {
        status: 'PASSED',
        message: 'Service configuration is valid',
        data: {
          availableServices: Object.keys(ECOMEXPRESS_CONFIG.SERVICES),
          configuredShippers: Object.keys(ECOMEXPRESS_CONFIG.SHIPPERS).filter(shipper =>
            ECOMEXPRESS_CONFIG.SHIPPERS[shipper].USERNAME
          )
        }
      };
      testResults.summary.passed++;
    } catch (error) {
      testResults.serviceHealth = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    testResults.summary.endTime = new Date().toISOString();
    testResults.summary.passRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);

    const status = testResults.summary.failed === 0 ? 200 : 207; // 207 = Multi-Status

    res.status(status).json({
      success: testResults.summary.failed === 0,
      message: `Ecom Express API tests completed - ${testResults.summary.passed}/${testResults.summary.total} passed`,
      data: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Ecom Express comprehensive test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Ecom Express comprehensive test execution failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Get Ecom Express configuration (sanitized)
 * Professional endpoint to view current Ecom Express configuration
 */
router.get('/config/ecomexpress', authenticateToken, authorizeRoles(['admin', 'super_admin']), (req, res) => {
  try {
    const config = {
      apiBaseUrl: ECOMEXPRESS_CONFIG.API_BASE_URL,
      shipmentBaseUrl: ECOMEXPRESS_CONFIG.SHIPMENT_BASE_URL,
      trackingBaseUrl: ECOMEXPRESS_CONFIG.TRACKING_BASE_URL,
      apiEndpoints: Object.keys(ECOMEXPRESS_CONFIG.ENDPOINTS),
      services: ECOMEXPRESS_CONFIG.SERVICES,
      useStaging: ECOMEXPRESS_CONFIG.USE_STAGING,
      requestTimeout: ECOMEXPRESS_CONFIG.REQUEST_TIMEOUT,
      shippers: {
        BA: {
          hasCredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.BA.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.BA.PASSWORD),
          usernameMasked: ECOMEXPRESS_CONFIG.SHIPPERS.BA.USERNAME ?
            ECOMEXPRESS_CONFIG.SHIPPERS.BA.USERNAME.substring(0, 3) + '***' : null,
          code: ECOMEXPRESS_CONFIG.SHIPPERS.BA.CODE
        },
        EXSPLUS: {
          hasCredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.PASSWORD),
          usernameMasked: ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.USERNAME ?
            ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.USERNAME.substring(0, 3) + '***' : null,
          code: ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.CODE
        },
        EGS: {
          hasCredentials: !!(ECOMEXPRESS_CONFIG.SHIPPERS.EGS.USERNAME && ECOMEXPRESS_CONFIG.SHIPPERS.EGS.PASSWORD),
          usernameMasked: ECOMEXPRESS_CONFIG.SHIPPERS.EGS.USERNAME ?
            ECOMEXPRESS_CONFIG.SHIPPERS.EGS.USERNAME.substring(0, 3) + '***' : null,
          code: ECOMEXPRESS_CONFIG.SHIPPERS.EGS.CODE
        }
      }
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Error getting Ecom Express configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Ecom Express configuration',
      details: error.message
    });
  }
});

/**
 * Test Ekart authentication
 * Professional endpoint to test Ekart API functionality
 */
router.post('/test/ekart/auth', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import Ekart utility
    const { authenticate } = await import('../../../utils/ekart.js');

    const result = await authenticate();

    res.json({
      success: true,
      message: 'Ekart authentication test successful',
      data: {
        tokenLength: result.length,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ekart authentication test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ekart authentication test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ekart serviceability check (V2)
 * Professional endpoint to test Ekart API functionality
 */
router.post('/test/ekart/serviceability', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { pincode = '110001' } = req.body;

    // Import Ekart utility
    const { checkServiceabilityV2 } = await import('../../../utils/ekart.js');

    const result = await checkServiceabilityV2(pincode);

    res.json({
      success: true,
      message: 'Ekart serviceability test completed',
      data: {
        testParameters: { pincode },
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ekart serviceability test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ekart serviceability test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ekart pricing estimates (V3)
 * Professional endpoint to test Ekart API functionality
 */
router.post('/test/ekart/pricing', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const {
      pickupPincode = '110001',
      dropPincode = '400001',
      weight = 500,
      paymentType = 'Prepaid',
      invoiceAmount = 100
    } = req.body;

    // Import Ekart utility
    const { checkServiceabilityV3 } = await import('../../../utils/ekart.js');

    const estimateData = {
      pickupPincode,
      dropPincode,
      weight,
      paymentType,
      invoiceAmount,
      length: 10,
      width: 10,
      height: 10
    };

    const result = await checkServiceabilityV3(estimateData);

    res.json({
      success: true,
      message: 'Ekart pricing estimate test completed',
      data: {
        testParameters: estimateData,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ekart pricing estimate test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ekart pricing estimate test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ekart shipment booking
 * Professional endpoint to test Ekart API functionality
 */
router.post('/test/ekart/booking', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import Ekart service
    const ekartService = (await import('../../../services/ekart.service.js')).default;

    // Create test shipment data
    const testShipmentData = {
      serviceType: 'standard',
      weight: 1,
      cod: true,
      declaredValue: 500,
      codAmount: 450,
      commodity: 'Test Product',
      orderNumber: `TEST${Date.now()}`,
      invoiceNumber: `INV${Date.now()}`,
      dimensions: {
        length: 20,
        width: 15,
        height: 10
      },
      shipper: {
        name: 'RocketryBox Test',
        phone: '9999999999',
        email: 'test@rocketrybox.in',
        gstNumber: 'TEST123456789',
        address: {
          line1: 'Test Address, Test Area',
          city: 'Mumbai',
          state: 'Maharashtra',
          pincode: '400001'
        }
      },
      consignee: {
        name: 'Test Customer',
        phone: '8888888888',
        address: {
          line1: 'Test Delivery Address',
          city: 'Delhi',
          state: 'Delhi',
          pincode: '110001'
        }
      }
    };

    const result = await ekartService.bookShipment(testShipmentData);

    res.json({
      success: true,
      message: 'Ekart booking test completed',
      data: {
        testParameters: testShipmentData,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ekart booking test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ekart booking test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ekart shipment tracking
 * Professional endpoint to test Ekart API functionality
 */
router.post('/test/ekart/tracking', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { trackingId } = req.body;

    if (!trackingId) {
      return res.status(400).json({
        success: false,
        error: 'Tracking ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Import Ekart utility
    const { trackShipment } = await import('../../../utils/ekart.js');

    const result = await trackShipment(trackingId);

    res.json({
      success: true,
      message: 'Ekart tracking test completed',
      data: {
        trackingId,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ekart tracking test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ekart tracking test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Ekart shipment cancellation
 * Professional endpoint to test Ekart API functionality
 */
router.post('/test/ekart/cancel', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { trackingId } = req.body;

    if (!trackingId) {
      return res.status(400).json({
        success: false,
        error: 'Tracking ID is required',
        timestamp: new Date().toISOString()
      });
    }

    // Import Ekart utility
    const { cancelShipment } = await import('../../../utils/ekart.js');

    const result = await cancelShipment(trackingId);

    res.json({
      success: true,
      message: 'Ekart cancellation test completed',
      data: {
        trackingId,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Ekart cancellation test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Ekart cancellation test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Run comprehensive Ekart API tests
 * Professional endpoint to test all Ekart API functionality
 */
router.get('/test/ekart/all', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import Ekart utilities
    const { authenticate, checkServiceabilityV2 } = await import('../../../utils/ekart.js');
    const ekartService = (await import('../../../services/ekart.service.js')).default;

    const testResults = {
      authentication: null,
      serviceability: null,
      serviceHealth: null,
      summary: {
        total: 3,
        passed: 0,
        failed: 0,
        startTime: new Date().toISOString()
      }
    };

    // Test 1: Authentication
    try {
      await authenticate();
      testResults.authentication = { status: 'PASSED', message: 'Authentication successful' };
      testResults.summary.passed++;
    } catch (error) {
      testResults.authentication = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    // Test 2: Serviceability Check
    try {
      const serviceabilityResult = await checkServiceabilityV2('110001');
      testResults.serviceability = {
        status: serviceabilityResult.success ? 'PASSED' : 'FAILED',
        message: 'Serviceability check completed',
        data: { testPincode: '110001', serviceable: serviceabilityResult.serviceable }
      };
      if (serviceabilityResult.success) {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    } catch (error) {
      testResults.serviceability = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    // Test 3: Service Health
    try {
      const healthStatus = await ekartService.getHealthStatus();
      testResults.serviceHealth = {
        status: healthStatus.status === 'HEALTHY' ? 'PASSED' : 'FAILED',
        data: healthStatus
      };
      if (healthStatus.status === 'HEALTHY') {
        testResults.summary.passed++;
      } else {
        testResults.summary.failed++;
      }
    } catch (error) {
      testResults.serviceHealth = { status: 'FAILED', error: error.message };
      testResults.summary.failed++;
    }

    testResults.summary.endTime = new Date().toISOString();
    testResults.summary.passRate = ((testResults.summary.passed / testResults.summary.total) * 100).toFixed(1);

    const status = testResults.summary.failed === 0 ? 200 : 207; // 207 = Multi-Status

    res.status(status).json({
      success: testResults.summary.failed === 0,
      message: `Ekart API tests completed - ${testResults.summary.passed}/${testResults.summary.total} passed`,
      data: testResults,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Ekart comprehensive test failed:', error);
    res.status(500).json({
      success: false,
      error: 'Ekart comprehensive test execution failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Get Ekart configuration (sanitized)
 * Professional endpoint to view current Ekart configuration
 */
router.get('/config/ekart', authenticateToken, authorizeRoles(['admin', 'super_admin']), (req, res) => {
  try {
    const config = {
      baseUrl: EKART_CONFIG.BASE_URL,
      clientId: EKART_CONFIG.CLIENT_ID,
      apiEndpoints: Object.keys(EKART_CONFIG.ENDPOINTS),
      serviceTypes: EKART_CONFIG.SERVICE_TYPES,
      paymentModes: EKART_CONFIG.PAYMENT_MODES,
      ndrActions: EKART_CONFIG.NDR_ACTIONS,
      webhookTopics: EKART_CONFIG.WEBHOOK_TOPICS,
      requestTimeout: EKART_CONFIG.REQUEST_TIMEOUT,
      maxCodAmount: EKART_CONFIG.MAX_COD_AMOUNT,
      maxLabelIds: EKART_CONFIG.MAX_LABEL_IDS,
      maxManifestIds: EKART_CONFIG.MAX_MANIFEST_IDS,
      hasUsername: !!EKART_CONFIG.USERNAME,
      hasPassword: !!EKART_CONFIG.PASSWORD,
      // Don't expose actual credentials
      usernameMasked: EKART_CONFIG.USERNAME ? EKART_CONFIG.USERNAME.substring(0, 3) + '***' : null
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Error getting Ekart configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Ekart configuration',
      details: error.message
    });
  }
});

/**
 * Test Delhivery waybill fetching
 * Professional endpoint to test Delhivery waybill API functionality
 */
router.post('/test/delhivery/waybills', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { count = 10 } = req.body;

    // Import Delhivery utility
    const { fetchWaybills } = await import('../../../utils/delhivery.js');

    const result = await fetchWaybills(count);

    res.json({
      success: true,
      message: 'Delhivery waybill fetch test successful',
      data: {
        requestedCount: count,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Delhivery waybill fetch test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Delhivery waybill fetch test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Get next available Delhivery waybill
 * Professional endpoint to get a single waybill for order creation
 */
router.get('/delhivery/waybill/next', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import Delhivery utility
    const { getNextWaybill } = await import('../../../utils/delhivery.js');

    const result = await getNextWaybill();

    res.json({
      success: true,
      message: 'Next Delhivery waybill retrieved successfully',
      data: {
        waybill: result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get next Delhivery waybill:', error);
    res.status(400).json({
      success: false,
      error: 'Failed to get next Delhivery waybill',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Delhivery serviceability check
 * Professional endpoint to test Delhivery serviceability API
 */
router.post('/test/delhivery/serviceability', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const { pincode = '110001' } = req.body;

    // Import Delhivery utility
    const { checkServiceability } = await import('../../../utils/delhivery.js');

    const result = await checkServiceability(pincode);

    res.json({
      success: true,
      message: 'Delhivery serviceability check successful',
      data: {
        pincode,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Delhivery serviceability check failed:', error);
    res.status(400).json({
      success: false,
      error: 'Delhivery serviceability check failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Delhivery rate calculation
 * Professional endpoint to test Delhivery rate calculation API
 */
router.post('/test/delhivery/rates', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    const {
      pickupPincode = '110001',
      deliveryPincode = '400001',
      weight = 1,
      paymentMode = 'prepaid',
      codAmount = 0
    } = req.body;

    // Import Delhivery utility
    const { calculateRate } = await import('../../../utils/delhivery.js');

    const packageDetails = {
      weight: weight,
      dimensions: { length: 10, width: 10, height: 10 },
      serviceType: 'surface',
      paymentMode,
      codAmount,
      declaredValue: codAmount || 100
    };

    const deliveryDetails = {
      pickupPincode,
      deliveryPincode
    };

    const result = await calculateRate(packageDetails, deliveryDetails, {});

    res.json({
      success: true,
      message: 'Delhivery rate calculation test successful',
      data: {
        testParameters: { pickupPincode, deliveryPincode, weight, paymentMode, codAmount },
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Delhivery rate calculation test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Delhivery rate calculation test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Test Delhivery order creation
 * Professional endpoint to test Delhivery order creation API
 */
router.post('/test/delhivery/order', authenticateToken, authorizeRoles(['admin', 'super_admin']), async (req, res) => {
  try {
    // Import Delhivery utility
    const { bookShipment } = await import('../../../utils/delhivery.js');

    // Create test shipment data
    const testShipmentData = {
      serviceType: 'surface',
      weight: 1,
      paymentMode: 'cod',
      codAmount: 500,
      declaredValue: 500,
      commodity: 'Test Product',
      dimensions: {
        length: 20,
        width: 15,
        height: 10
      },
      shipper: {
        name: 'RocketryBox Test',
        phone: '9999999999',
        address: {
          line1: 'Test Address, Test Area',
          city: 'Noida',
          state: 'Uttar Pradesh',
          pincode: '201301'
        }
      },
      consignee: {
        name: 'Test Customer',
        phone: '8888888888',
        address: {
          line1: 'Test Delivery Address',
          city: 'Bangalore',
          state: 'Karnataka',
          pincode: '560001'
        }
      }
    };

    const result = await bookShipment(testShipmentData);

    res.json({
      success: true,
      message: 'Delhivery order creation test completed',
      data: {
        testParameters: testShipmentData,
        result,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Delhivery order creation test failed:', error);
    res.status(400).json({
      success: false,
      error: 'Delhivery order creation test failed',
      details: {
        message: error.message,
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * Get Delhivery configuration (sanitized)
 * Professional endpoint to view current Delhivery configuration
 */
router.get('/config/delhivery', authenticateToken, authorizeRoles(['admin', 'super_admin']), (req, res) => {
  try {
    const config = {
      apiUrl: DELHIVERY_CONFIG.API_URL,
      stagingUrl: DELHIVERY_CONFIG.STAGING_URL,
      environment: DELHIVERY_CONFIG.ENVIRONMENT,
      hasApiToken: !!DELHIVERY_CONFIG.API_TOKEN,
      hasB2BCredentials: !!(DELHIVERY_CONFIG.B2B_USERNAME && DELHIVERY_CONFIG.B2B_PASSWORD),
      requestTimeout: DELHIVERY_CONFIG.REQUEST_TIMEOUT,
      // Don't expose actual credentials
      apiTokenMasked: DELHIVERY_CONFIG.API_TOKEN ? '***' + DELHIVERY_CONFIG.API_TOKEN.slice(-4) : null,
      b2bUsernameMasked: DELHIVERY_CONFIG.B2B_USERNAME ? DELHIVERY_CONFIG.B2B_USERNAME.substring(0, 3) + '***' : null
    };

    res.json({
      success: true,
      data: config
    });

  } catch (error) {
    logger.error('Error getting Delhivery configuration:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get Delhivery configuration',
      details: error.message
    });
  }
});

export default router;
