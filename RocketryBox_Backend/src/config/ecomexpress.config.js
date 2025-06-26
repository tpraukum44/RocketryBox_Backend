import 'dotenv/config';

/**
 * Ecom Express API Configuration
 * Updated with OFFICIAL PRODUCTION and STAGING URLs from EcomExpress documentation
 */
export const ECOMEXPRESS_CONFIG = {
  // OFFICIAL Production API Endpoints - Hardcoded
  API_BASE_URL: 'https://api.ecomexpress.in',
  SHIPMENT_BASE_URL: 'https://shipment.ecomexpress.in', // Using lowercase 's' version
  TRACKING_BASE_URL: 'https://plapi.ecomexpress.in',

  // OFFICIAL Production API Endpoints (from EcomExpress documentation)
  ENDPOINTS: {
    // Account Management APIs (NEW - from official docs)
    CREATE_COMPANY_V2: '/company/V2/create',
    CREATE_LOCATION: '/createLocation',
    CHECK_COMPANY: '/company/checkCompany',

    // Existing shipping APIs
    PINCODE_CHECK: '/apiv2/pincode/', // PRODUCTION: https://api.ecomexpress.in/apiv2/pincode/
    EXPP_PINCODE_CHECK: '/services/expp/expppincode/', // EXPRESS+ PINCODE CHECK (NEW - Official)
    FETCH_AWB: '/apiv2/fetch_awb/', // PRODUCTION: https://api.ecomexpress.in/apiv2/fetch_awb/
    FETCH_AWB_V2: '/services/shipment/products/v2/fetch_awb/', // PRODUCTION: https://Shipment.ecomexpress.in/services/shipment/products/v2/fetch_awb/
    MANIFEST: '/apiv2/manifest_awb/', // PRODUCTION: https://api.ecomexpress.in/apiv2/manifest_awb/
    MANIFEST_V2: '/services/expp/manifest/v2/expplus/', // PRODUCTION: https://shipment.ecomexpress.in/services/expp/manifest/v2/expplus/
    REVERSE_MANIFEST: '/apiv2/manifest_awb_rev_v2/', // PRODUCTION: https://api.ecomexpress.in/apiv2/manifest_awb_rev_v2/
    TRACKING: '/track_me/api/mawbd/', // PRODUCTION: https://plapi.ecomexpress.in/track_me/api/mawbd/
    NDR_DATA: '/apiv2/ndr_resolutions/', // PRODUCTION: https://api.ecomexpress.in/apiv2/ndr_resolutions/
    CANCEL_AWB: '/apiv2/cancel_awb/', // PRODUCTION: https://api.ecomexpress.in/apiv2/cancel_awb/?=
    SHIPPING_LABEL: '/services/expp/shipping_label', // PRODUCTION: https://shipment.ecomexpress.in/services/expp/shipping_label
    // NEW APIs from official documentation
    EWAYBILL_UPDATE: '/apiv2/ern_update_api/', // E-WAY BILL UPDATE API
    DYNAMIC_QR_CODE: '/services/dynamicQRCodeAPI/', // DYNAMIC QR CODE API
    PAYMENT_MODE_UPDATE: '/apiv2/changeProductType/', // PAYMENT MODE UPDATE API
    WEIGHT_UPDATE: '/services/weight_update_api/', // WEIGHT UPDATE API
    POD_GENERATION: '/services/generatecustomerpod/' // POD GENERATION API
  },

  // Production Only - No Staging URLs

  // Production Credentials (No Fallback Values)
  SHIPPERS: {
    BA: {
      CODE: process.env.ECOMEXPRESS_BA_CODE,
      USERNAME: process.env.ECOMEXPRESS_BA_USERNAME,
      PASSWORD: process.env.ECOMEXPRESS_BA_PASSWORD
    },
    EXSPLUS: {
      CODE: process.env.ECOMEXPRESS_EXSPLUS_CODE,
      USERNAME: process.env.ECOMEXPRESS_EXSPLUS_USERNAME,
      PASSWORD: process.env.ECOMEXPRESS_EXSPLUS_PASSWORD
    },
    EGS: {
      CODE: process.env.ECOMEXPRESS_EGS_CODE,
      USERNAME: process.env.ECOMEXPRESS_EGS_USERNAME,
      PASSWORD: process.env.ECOMEXPRESS_EGS_PASSWORD
    }
  },

  // Account Management API Credentials (NEW - from official docs)
  ACCOUNT_API: {
    X_API_KEY: process.env.ECOMEXPRESS_X_API_KEY,
    JWT_TOKEN: process.env.ECOMEXPRESS_JWT_TOKEN,
    BASE_URL: 'https://api.ecomexpress.in'
  },

  // Service Configuration
  SERVICES: {
    STANDARD: 'BA',      // Basic service
    EXPRESS: 'EXSPLUS',  // Express Plus service
    ECONOMY: 'EGS'       // Economy service
  },

  // Pricing Configuration
  BASE_RATE: 40,       // Base shipping rate
  WEIGHT_RATE: 15,     // Rate per kg
  COD_CHARGE: 25,      // COD handling charge

  // Dimensional factor for volumetric weight calculation
  DIMENSIONAL_FACTOR: 5000, // (L*W*H)/5000 for volumetric weight calculation

  // Timeouts
  REQUEST_TIMEOUT: 30000, // 30 seconds

  // Environment specific settings - Production Only
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',

  // Get shipper details based on service type
  getShipperDetails(serviceType = 'standard') {
    const serviceMap = {
      'express': this.SHIPPERS.EXSPLUS,
      'standard': this.SHIPPERS.BA,
      'economy': this.SHIPPERS.EGS
    };

    const shipper = serviceMap[serviceType] || this.SHIPPERS.BA;

    if (!shipper || !shipper.USERNAME || !shipper.PASSWORD) {
      throw new Error(`Ecom Express credentials not configured for service type: ${serviceType}`);
    }

    return shipper;
  },

  // Get base URL based on endpoint type
  getBaseUrl(endpoint = 'API') {
    switch (endpoint) {
      case 'SHIPMENT':
        return this.SHIPMENT_BASE_URL;
      case 'TRACKING':
        return this.TRACKING_BASE_URL;
      default:
        return this.API_BASE_URL;
    }
  },

  // Get endpoint path
  getEndpoint(endpointName) {
    return this.ENDPOINTS[endpointName];
  },

  // Get API Headers
  getHeaders() {
    return {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': 'application/json',
      'User-Agent': 'RocketryBox-EcomExpress-Integration/1.0'
    };
  },

  // Get JSON Headers (for specific APIs that need JSON)
  getJSONHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'RocketryBox-EcomExpress-Integration/1.0'
    };
  },

  // Get Account Management API Headers (NEW - from official docs)
  getAccountHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'x-api-key': this.ACCOUNT_API.X_API_KEY,
      'Authorization': `Bearer ${this.ACCOUNT_API.JWT_TOKEN}`,
      'User-Agent': 'RocketryBox-EcomExpress-Integration/1.0'
    };
  },

  // Create form data payload
  createFormData(params) {
    const formData = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        formData.append(key, value.toString());
      }
    });
    return formData;
  },

  // Helper method to create authenticated form data
  createAuthenticatedFormData(serviceType, additionalParams = {}) {
    const shipper = this.getShipperDetails(serviceType);
    const params = {
      username: shipper.USERNAME,
      password: shipper.PASSWORD,
      ...additionalParams
    };
    return this.createFormData(params);
  },

  // Get tracking URL
  getTrackingUrl(awb) {
    return `https://www.ecomexpress.in/tracking/?awb=${awb}`;
  },

  // Validation - Production Only
  validate() {
    const requiredShippers = ['BA', 'EXSPLUS', 'EGS'];
    const missingShippers = requiredShippers.filter(shipper =>
      !this.SHIPPERS[shipper] || !this.SHIPPERS[shipper].USERNAME || !this.SHIPPERS[shipper].PASSWORD
    );

    if (missingShippers.length > 0) {
      throw new Error(`Missing Ecom Express credentials for: ${missingShippers.join(', ')}`);
    }

    return true;
  }
};

// Validate configuration on import
try {
  if (ECOMEXPRESS_CONFIG.SHIPPERS.BA.USERNAME || ECOMEXPRESS_CONFIG.SHIPPERS.EXSPLUS.USERNAME || ECOMEXPRESS_CONFIG.SHIPPERS.EGS.USERNAME) {
    ECOMEXPRESS_CONFIG.validate();
  }
} catch (error) {
  // Silent validation failure
}

export default ECOMEXPRESS_CONFIG;
