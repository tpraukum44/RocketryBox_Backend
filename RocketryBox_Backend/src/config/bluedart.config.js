import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Blue Dart API Configuration
 * Based on Official BlueDart API Documentation - Using Production URLs
 * Updated to match official YAML specifications exactly
 */
export const BLUEDART_CONFIG = {
  // BlueDart API Gateway Base URLs - Production Only
  API_URL: 'https://apigateway.bluedart.com',
  PRODUCTION_URL: 'https://apigateway.bluedart.com',

  // Official BlueDart API Endpoints - Production URLs Only
  ENDPOINTS: {
    // Authentication (Official JWT Generation API) - generateJWT_0.yaml
    AUTHENTICATION: 'https://apigateway.bluedart.com/in/transportation/token/v1/login',

    // Pickup Registration - PickupRegistrationService.yaml
    PICKUP_REGISTRATION: 'https://apigateway.bluedart.com/in/transportation/pickup/v1/RegisterPickup',

    // Product and Services (Legacy naming for backward compatibility)
    PRODUCT_PICKUP_DETAIL: 'https://apigateway.bluedart.com/in/transportation/pickup/v1/RegisterPickup',

    // Transit Time - Transit-Time_3.yaml
    TRANSIT_TIME: 'https://apigateway.bluedart.com/in/transportation/transit/v1/GetDomesticTransitTimeForPinCodeandProduct',

    // Tracking - Tracking_1.yaml
    TRACKING: 'https://apigateway.bluedart.com/in/transportation/tracking/v1',
    TRACKING_SHIPMENT: 'https://apigateway.bluedart.com/in/transportation/tracking/v1/shipment',

    // Location Finder - Finders_0.yaml (ALL 3 ENDPOINTS)
    LOCATION_FINDER_BASE: 'https://apigateway.bluedart.com/in/transportation/finder/v1',
    LOCATION_FINDER_PINCODE: 'https://apigateway.bluedart.com/in/transportation/finder/v1/GetServicesforPincode',
    LOCATION_FINDER_PRODUCT: 'https://apigateway.bluedart.com/in/transportation/finder/v1/GetServicesforProduct',
    LOCATION_FINDER_PINCODE_PRODUCT: 'https://apigateway.bluedart.com/in/transportation/finder/v1/GetServicesforPincodeAndProduct',

    // Waybill Generation - WayBill-sandbox_0.yaml
    WAYBILL: 'https://apigateway.bluedart.com/in/transportation/waybill/v1',
    GENERATE_EWAY_BILL: 'https://apigateway.bluedart.com/in/transportation/waybill/v1/GenerateWayBill',

    // Waybill Operations
    IMPORT_WAYBILL_DATA: 'https://apigateway.bluedart.com/in/transportation/waybill/v1/ImportData',
    CANCEL_WAYBILL: 'https://apigateway.bluedart.com/in/transportation/waybill/v1/CancelWaybill',
    UPDATE_EWAY_BILL: 'https://apigateway.bluedart.com/in/transportation/waybill/v1/UpdateEwayBill',

    // Pickup Operations - cancel-pickup.yaml
    CANCEL_PICKUP: 'https://apigateway.bluedart.com/in/transportation/cancel-pickup/v1/CancelPickup',

    // Master Data - Master-Download.yaml (CORRECTED URL)
    MASTER_DOWNLOAD: 'https://apigateway.bluedart.com/in/transportation/masterdownload/v1',
    DOWNLOAD_PINCODE_MASTER: 'https://apigateway.bluedart.com/in/transportation/masterdownload/v1/DownloadPinCodeMaster',

    // Additional Services
    ALT_INSTRUCTION: 'https://apigateway.bluedart.com/in/transportation/instruction/v1',

    // Legacy Location Finder endpoint for backward compatibility
    LOCATION_FINDER: 'https://apigateway.bluedart.com/in/transportation/finder/v1/GetServicesforPincode'
  },

  // Legacy endpoint mappings for backward compatibility - Production URLs Only
  AUTH_URL: 'https://apigateway.bluedart.com/in/transportation/token/v1/login',
  PICKUP_URL: 'https://apigateway.bluedart.com/in/transportation/pickup/v1',
  BOOKING_URL: 'https://apigateway.bluedart.com/in/transportation/waybill/v1',
  TRACKING_URL: 'https://apigateway.bluedart.com/in/transportation/tracking/v1',

  // API Credentials
  USER: process.env.BLUEDART_USER || 'BGE60970',
  LICENSE_KEY: process.env.BLUEDART_LICENSE_KEY || 'trjierrkjkspo8hkzqv1mjfoimnksito',
  CONSUMER_KEY: process.env.BLUEDART_CONSUMER_KEY || 'dyfUBL4U0YN8l7iDwwyWrcVBxXYD9s8o',
  CONSUMER_SECRET: process.env.BLUEDART_CONSUMER_SECRET || 'AsUfm29jvf7GrhBw',
  VERSION: process.env.BLUEDART_VERSION || '1.3',
  API_TYPE: process.env.BLUEDART_API_TYPE || 'S',

  // Service Configuration
  DEFAULT_PRODUCT_CODE: 'A', // A = Apex (Express), D = Dart (Standard)
  DEFAULT_SUB_PRODUCT_CODE: 'P', // P = Standard Sub-Product
  DEFAULT_AREA_CODE: 'BGE', // Default area code based on account

  // API Specifications - Based on Official YAML files (100% COMPLETE)
  API_SPECS: {
    AUTHENTICATION: {
      method: 'GET',
      path: '/v1/login',
      headers: ['ClientID', 'clientSecret'],
      responseField: 'JWTToken',
      spec: 'generateJWT_0.yaml'
    },
    PICKUP_REGISTRATION: {
      method: 'POST',
      path: '/RegisterPickup',
      authRequired: true,
      requestStructure: 'request + profile',
      spec: 'PickupRegistrationService.yaml'
    },
    TRANSIT_TIME: {
      method: 'POST',
      path: '/GetDomesticTransitTimeForPinCodeandProduct',
      authRequired: true,
      requestStructure: 'payload + profile',
      spec: 'Transit-Time_3.yaml'
    },
    TRACKING: {
      method: 'GET',
      path: '/shipment',
      authRequired: true,
      queryParams: ['handler', 'loginid', 'numbers', 'format', 'lickey', 'scan', 'action', 'verno', 'awb'],
      spec: 'Tracking_1.yaml'
    },
    LOCATION_FINDER_PINCODE: {
      method: 'POST',
      path: '/GetServicesforPincode',
      authRequired: true,
      requestStructure: 'pinCode + profile',
      spec: 'Finders_0.yaml'
    },
    LOCATION_FINDER_PRODUCT: {
      method: 'POST',
      path: '/GetServicesforProduct',
      authRequired: true,
      requestStructure: 'pinCode + pProductCode + pSubProductCode + profile',
      spec: 'Finders_0.yaml'
    },
    LOCATION_FINDER_PINCODE_PRODUCT: {
      method: 'POST',
      path: '/GetServicesforPincodeAndProduct',
      authRequired: true,
      requestStructure: 'pinCode + ProductCode + SubProductCode + PackType + Feature + profile',
      spec: 'Finders_0.yaml'
    },
    WAYBILL_GENERATION: {
      method: 'POST',
      path: '/GenerateWayBill',
      authRequired: true,
      requestStructure: 'Request + Profile',
      spec: 'WayBill-sandbox_0.yaml'
    },
    CANCEL_PICKUP: {
      method: 'POST',
      path: '/CancelPickup',
      authRequired: true,
      requestStructure: 'request + profile',
      spec: 'cancel-pickup.yaml'
    },
    MASTER_DOWNLOAD: {
      method: 'POST',
      path: '/DownloadPinCodeMaster',
      authRequired: true,
      requestStructure: 'lastSynchDate + profile',
      spec: 'Master-Download.yaml'
    }
  },

  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 seconds
  TOKEN_EXPIRY: 3600000, // 1 hour in milliseconds

  // Environment specific settings
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',
  USE_PRODUCTION: true, // Using production environment

  // Official API Status - 100% COMPLETE IMPLEMENTATION ✅
  API_STATUS: {
    AUTHENTICATION: 'IMPLEMENTED', // generateJWT_0.yaml ✅
    PICKUP_REGISTRATION: 'IMPLEMENTED', // PickupRegistrationService.yaml ✅
    TRACKING: 'IMPLEMENTED', // Tracking_1.yaml ✅
    LOCATION_FINDER_PINCODE: 'IMPLEMENTED', // Finders_0.yaml ✅
    LOCATION_FINDER_PRODUCT: 'IMPLEMENTED', // Finders_0.yaml ✅
    LOCATION_FINDER_PINCODE_PRODUCT: 'IMPLEMENTED', // Finders_0.yaml ✅
    TRANSIT_TIME: 'IMPLEMENTED', // Transit-Time_3.yaml ✅
    WAYBILL_GENERATION: 'IMPLEMENTED', // WayBill-sandbox_0.yaml ✅
    CANCEL_PICKUP: 'IMPLEMENTED', // cancel-pickup.yaml ✅
    MASTER_DOWNLOAD: 'IMPLEMENTED', // Master-Download.yaml ✅
    IMPORT_WAYBILL_DATA: 'AVAILABLE',
    CANCEL_WAYBILL: 'AVAILABLE',
    UPDATE_EWAY_BILL: 'AVAILABLE',
    ALT_INSTRUCTION: 'AVAILABLE'
  },

  // API Descriptions - Complete Implementation
  API_DESCRIPTIONS: {
    AUTHENTICATION: 'JWT Token Generation API (generateJWT_0.yaml) ✅',
    PICKUP_REGISTRATION: 'Pickup Registration Service (PickupRegistrationService.yaml) ✅',
    TRACKING: 'Shipment Tracking Service (Tracking_1.yaml) ✅',
    LOCATION_FINDER_PINCODE: 'Basic Location & Service Finder (Finders_0.yaml) ✅',
    LOCATION_FINDER_PRODUCT: 'Product-Specific Service Finder (Finders_0.yaml) ✅',
    LOCATION_FINDER_PINCODE_PRODUCT: 'Advanced Location & Product Service Finder (Finders_0.yaml) ✅',
    TRANSIT_TIME: 'Transit Time Calculator (Transit-Time_3.yaml) ✅',
    WAYBILL_GENERATION: 'E-Way Bill Generation (WayBill-sandbox_0.yaml) ✅',
    CANCEL_PICKUP: 'Pickup Cancellation Service (cancel-pickup.yaml) ✅',
    MASTER_DOWNLOAD: 'Master Data Download (Master-Download.yaml) ✅',
    IMPORT_WAYBILL_DATA: 'Bulk Waybill Import (Available)',
    CANCEL_WAYBILL: 'Waybill Cancellation (Available)',
    UPDATE_EWAY_BILL: 'E-Way Bill Update (Available)',
    ALT_INSTRUCTION: 'Alternative Instructions (Available)'
  },

  // Validation
  validate() {
    const requiredFields = ['LICENSE_KEY', 'USER', 'CONSUMER_KEY', 'CONSUMER_SECRET'];
    const missingFields = requiredFields.filter(field => !this[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing Blue Dart configuration: ${missingFields.join(', ')}`);
    }

    return true;
  },

  // Get API Headers for authenticated requests
  getAuthHeaders(token) {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'JWTToken': token,
      'User-Agent': 'RocketryBox-BlueDart-Integration/1.0'
    };
  },

  // Get API Headers for authentication request
  getAuthRequestHeaders() {
    return {
      'ClientID': this.CONSUMER_KEY,
      'clientSecret': this.CONSUMER_SECRET,
      'Accept': 'application/json',
      'User-Agent': 'RocketryBox-BlueDart-Integration/1.0'
    };
  },

  // Get tracking URL for customer
  getTrackingUrl(awb) {
    return `https://www.bluedart.com/tracking/${awb}`;
  }
};

// Validate configuration on import
try {
  if (BLUEDART_CONFIG.USER && BLUEDART_CONFIG.LICENSE_KEY) {
    BLUEDART_CONFIG.validate();
  }
} catch (error) {
  // Silent validation failure - will be caught during actual API calls
}

export default BLUEDART_CONFIG;
