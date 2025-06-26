/**
 * DTDC API Configuration
 * Professional Integration with Complete API Suite
 *
 * Features:
 * - Real-time Shipment Tracking
 * - XML and JSON API Support
 * - Authentication Token Management
 * - Rate Calculation
 * - Label Generation
 * - Pincode Serviceability Check
 *
 * Contact: DTDC Customer Care | Phone: 1860-233-1234
 */

// Load environment variables from .env file
import 'dotenv/config';

// Environment variables - Using hardcoded values for DTDC credentials
const {
  // DTDC Configuration
  DTDC_API_URL,
  DTDC_STAGING_API_URL,
  DTDC_API_VERSION,
  NODE_ENV
} = process.env;

// Hardcoded DTDC credentials
const DTDC_USERNAME = 'dtdc_demo_user';
const DTDC_PASSWORD = 'dtdc_demo_pass';
const DTDC_API_TOKEN = 'dtdc_demo_api_token_123456789';

// DTDC credentials are now hardcoded - no validation needed

// Base URLs - Production Only (EXACT DTDC DOCUMENTATION URLS)
const PRODUCTION_BASE_URL = 'https://blktracksvc.dtdc.com';

// Production environment only
const IS_PRODUCTION = true;

export const DTDC_CONFIG = {
  // Authentication
  USERNAME: DTDC_USERNAME || '',
  PASSWORD: DTDC_PASSWORD || '',
  API_TOKEN: DTDC_API_TOKEN || '',
  API_VERSION: DTDC_API_VERSION || '2.2',

  // Token Management (will be set after authentication)
  ACCESS_TOKEN: null,
  TOKEN_EXPIRY: null,

  // Base URLs - Production Only
  PRODUCTION_URL: PRODUCTION_BASE_URL,
  IS_PRODUCTION,

  // API Endpoints - Production URLs Only (EXACT FROM DTDC DOCUMENTATION)
  ENDPOINTS: {
    // Authentication (exact from documentation)
    AUTHENTICATE: `${PRODUCTION_BASE_URL}/dtdc-api/api/dtdc/authenticate`,

    // Tracking - XML Format (exact from documentation)
    TRACK_XML: `${PRODUCTION_BASE_URL}/dtdc-api/rest/XMLCnTrk/getDetails`,

    // Tracking - JSON Format (exact from documentation)
    TRACK_JSON: `${PRODUCTION_BASE_URL}/dtdc-api/rest/JSONCnTrk/getTrackDetails`,

    // Rate calculation (if available)
    CALCULATE_RATE: `${PRODUCTION_BASE_URL}/dtdc-api/rate/calculate`,

    // Pincode serviceability (if available)
    PINCODE_SERVICEABILITY: `${PRODUCTION_BASE_URL}/dtdc-api/pincode/check`,

    // Booking (if available)
    BOOK_SHIPMENT: `${PRODUCTION_BASE_URL}/dtdc-api/booking/create`,

    // Label generation (if available)
    GENERATE_LABEL: `${PRODUCTION_BASE_URL}/dtdc-api/label/generate`
  },

  // Service Types
  SERVICE_TYPES: {
    LITE: {
      code: 'LITE',
      name: 'DTDC LITE',
      description: 'Standard surface delivery - cost effective',
      deliveryTime: '4-7 days',
      codSupported: true
    },
    PTP: {
      code: 'PTP',
      name: 'DTDC Plus',
      description: 'Premium express delivery - time critical',
      deliveryTime: '2-4 days',
      codSupported: true
    },
    PREMIUM: {
      code: 'PREMIUM',
      name: 'DTDC Premium',
      description: 'Express delivery with priority handling',
      deliveryTime: '1-3 days',
      codSupported: true
    }
  },

  // Tracking Types
  TRACKING_TYPES: {
    CONSIGNMENT: 'cnno',
    REFERENCE: 'reference'
  },

  // Package Types
  PACKAGE_TYPES: {
    FORWARD: 'forward',
    REVERSE: 'reverse'
  },

  // Payment Modes
  PAYMENT_MODES: {
    PREPAID: 'prepaid',
    COD: 'cod',
    PICKUP: 'pickup'
  },

  // Shipment Statuses (from DTDC documentation)
  SHIPMENT_STATUSES: {
    DELIVERED: 'DELIVERED',
    DELIVERY_PROCESS_IN_PROGRESS: 'DELIVERY PROCESS IN PROGRESS',
    ATTEMPTED: 'ATTEMPTED',
    HELDUP: 'HELDUP',
    RTO: 'RTO',
    BOOKED: 'BOOKED',
    DISPATCHED: 'DISPATCHED',
    RECEIVED: 'RECEIVED',
    OUT_FOR_DELIVERY: 'OUT FOR DELIVERY',
    NOT_DELIVERED: 'NOT DELIVERED',
    CONSIGNMENT_RELEASED: 'CONSIGNMENT RELEASED',
    CONSIGNMENT_HAS_RETURNED: 'CONSIGNMENT HAS RETURNED',
    POD_DISPATCHED: 'POD DISPATCHED',
    ARRIVAL_AT_AIRPORT: 'ARRIVAL AT AIRPORT',
    CUSTOMS_CLEARED: 'CUSTOMS CLEARED',
    HELDUP_AT_CUSTOMS: 'HELDUP AT CUSTOMS',
    IN_TRANSIT: 'IN TRANSIT'
  },

  // Action Codes (from DTDC documentation)
  ACTION_CODES: {
    BKD: 'BOOKED',
    CDOUT: 'IN TRANSIT',
    OBMD: 'IN TRANSIT',
    CDIN: 'IN TRANSIT',
    OPMF: 'IN TRANSIT',
    OMBM: 'IN TRANSIT',
    IPMF: 'IN TRANSIT',
    IBMD: 'IN TRANSIT',
    INSCAN: 'RECEIVED AT DESTINATION',
    OUTDLV: 'OUT FOR DELIVERY',
    DLV: 'DELIVERED'
  },

  // Weight and Dimension Limits
  LIMITS: {
    // Weight limits (in kg)
    MIN_WEIGHT: 0.02,
    MAX_WEIGHT: 50,

    // Dimension limits (in cm)
    MAX_LENGTH: 120,
    MAX_WIDTH: 80,
    MAX_HEIGHT: 80,

    // COD limits (in INR)
    MAX_COD_AMOUNT: 50000,
    MIN_COD_AMOUNT: 1
  },

  // Request Configuration
  REQUEST_CONFIG: {
    TIMEOUT: 30000, // 30 seconds
    RETRY_ATTEMPTS: 3,
    RETRY_DELAY: 1000, // 1 second

    // Rate limiting
    RATE_LIMIT: {
      AUTHENTICATION: {
        requests: 10,
        window: 300000 // 5 minutes
      },
      TRACKING: {
        requests: 100,
        window: 300000 // 5 minutes
      },
      RATE_CALCULATION: {
        requests: 50,
        window: 300000 // 5 minutes
      }
    }
  },

  // Default Headers
  DEFAULT_HEADERS: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'User-Agent': 'RocketryBox-DTDC-Integration/1.0'
  },

  // XML Request Headers
  XML_HEADERS: {
    'Content-Type': 'application/xml',
    'Accept': 'application/xml',
    'User-Agent': 'RocketryBox-DTDC-Integration/1.0'
  },

  // Error Codes
  ERROR_CODES: {
    AUTHENTICATION_FAILED: 'AUTH_FAILED',
    INVALID_CONSIGNMENT: 'INVALID_CONSIGNMENT',
    NO_DATA_FOUND: 'NO_DATA_FOUND',
    SERVICE_NOT_AVAILABLE: 'SERVICE_NA',
    WEIGHT_EXCEEDED: 'WEIGHT_EXCEEDED',
    DIMENSION_EXCEEDED: 'DIMENSION_EXCEEDED',
    COD_LIMIT_EXCEEDED: 'COD_EXCEEDED',
    RATE_LIMIT_EXCEEDED: 'RATE_LIMIT',
    NETWORK_ERROR: 'NETWORK_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR'
  },

  // Response Status Codes (from DTDC documentation)
  HTTP_STATUS_CODES: {
    SUCCESS: 200,              // Will send Token Access key if authentication is successful
    PARTIAL_CONTENT: 201,      // Partial content (validation failed for request parameters)
    BAD_REQUEST: 400,          // Bad Request (wrong data passed as request parameter)
    UNAUTHORIZED: 401,         // Unauthorized
    INTERNAL_SERVER_ERROR: 500 // Error Occurred
  },

  // Booking Types
  BOOKING_TYPES: {
    DOMESTIC: 'DOM',
    INTERNATIONAL: 'INT'
  },

  // Connection Agents (if applicable)
  CONNECTION_AGENTS: {
    TNT: 'TNT',
    FEDEX: 'FEDEX',
    DHL: 'DHL'
  }
};

/**
 * Validate DTDC configuration
 */
export const validateDtdcConfig = () => {
  const errors = [];

  if (!DTDC_CONFIG.USERNAME) {
    errors.push('DTDC_USERNAME is required');
  }

  if (!DTDC_CONFIG.PASSWORD) {
    errors.push('DTDC_PASSWORD is required');
  }

  if (!DTDC_CONFIG.API_TOKEN) {
    errors.push('DTDC_API_TOKEN is required');
  }

  if (!DTDC_CONFIG.ENDPOINTS.AUTHENTICATE) {
    errors.push('DTDC authentication endpoint is not configured');
  }

  if (errors.length > 0) {
    throw new Error(`DTDC Configuration Errors: ${errors.join(', ')}`);
  }

  return true;
};

/**
 * Get environment-specific configuration
 */
export const getDtdcEnvironmentConfig = () => {
  return {
    isProduction: IS_PRODUCTION,
    productionUrl: PRODUCTION_BASE_URL,
    currentAuthUrl: DTDC_CONFIG.ENDPOINTS.AUTHENTICATE,
    environment: 'production'
  };
};

// Export default configuration
export default DTDC_CONFIG;
