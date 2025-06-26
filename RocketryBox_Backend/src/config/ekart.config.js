import 'dotenv/config';

/**
 * Ekart Logistics API Configuration
 * Based on official API documentation v3.8.1 and OpenAPI specification
 * Updated to use exact environment variables provided by user
 */
export const EKART_CONFIG = {
  // API Base Configuration - Production URL Only
  BASE_URL: 'https://app.elite.ekartlogistics.in',
  CLIENT_ID: process.env.EKART_CLIENT_ID,

  // Authentication Credentials - Using exact environment variable names
  USERNAME: process.env.EKART_USERNAME,
  PASSWORD: process.env.EKART_PASSWORD,

  // Development Mode Flag
  IS_DEVELOPMENT: process.env.NODE_ENV !== 'production',

  // API Endpoints - Exact paths from OpenAPI specification
  ENDPOINTS: {
    // Authentication - POST /integrations/v2/auth/token/{client_id}
    AUTH_TOKEN: '/integrations/v2/auth/token',

    // Shipment Management - PUT /api/v1/package/create
    CREATE_SHIPMENT: '/api/v1/package/create',
    // DELETE /api/v1/package/cancel
    CANCEL_SHIPMENT: '/api/v1/package/cancel',

    // Labels & Manifest - POST /api/v1/package/label
    DOWNLOAD_LABEL: '/api/v1/package/label',
    // POST /data/v2/generate/manifest
    GENERATE_MANIFEST: '/data/v2/generate/manifest',

    // Tracking - GET /api/v1/track/{id} (no authentication required)
    TRACK_SHIPMENT: '/api/v1/track',

    // Serviceability - GET /api/v2/serviceability/{pincode}
    SERVICEABILITY_V2: '/api/v2/serviceability',
    // POST /data/v3/serviceability
    SERVICEABILITY_V3: '/data/v3/serviceability',

    // NDR Management - POST /api/v2/package/ndr
    NDR_ACTION: '/api/v2/package/ndr',

    // Address Management - POST /api/v2/address
    ADD_ADDRESS: '/api/v2/address',
    // GET /api/v2/addresses
    GET_ADDRESSES: '/api/v2/addresses',

    // Webhook Management - GET/POST /api/v2/webhook
    WEBHOOK: '/api/v2/webhook',

    // Pricing - POST /data/pricing/estimate
    ESTIMATE_PRICING: '/data/pricing/estimate'
  },

  // Service Types from OpenAPI spec
  SERVICE_TYPES: {
    SURFACE: 'SURFACE',
    EXPRESS: 'EXPRESS'
  },

  // Payment Modes from OpenAPI spec
  PAYMENT_MODES: {
    COD: 'COD',
    PREPAID: 'Prepaid',
    PICKUP: 'Pickup' // For reverse shipments
  },

  // NDR Actions from OpenAPI spec
  NDR_ACTIONS: {
    RE_ATTEMPT: 'Re-Attempt',
    RTO: 'RTO',
    EDIT: 'Edit'
  },

  // Webhook Topics from OpenAPI spec
  WEBHOOK_TOPICS: {
    TRACK_UPDATED: 'track_updated',
    SHIPMENT_CREATED: 'shipment_created',
    SHIPMENT_RECREATED: 'shipment_recreated'
  },

  // Request Configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds
  MAX_RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 2000, // 2 seconds

  // Token Management with caching and expiry handling
  TOKEN_CACHE_KEY: 'ekart_access_token',
  TOKEN_EXPIRY_BUFFER: 300, // 5 minutes buffer before token expiry

  // File Upload Limits from OpenAPI spec
  MAX_LABEL_IDS: 100,
  MAX_MANIFEST_IDS: 100,

  // COD Limits from OpenAPI spec
  MAX_COD_AMOUNT: 49999,

  // Dimension Limits (in cm) and weight limits (in grams)
  DIMENSION_LIMITS: {
    MIN_LENGTH: 1,
    MIN_WIDTH: 1,
    MIN_HEIGHT: 1,
    MIN_WEIGHT: 1 // in grams
  },

  /**
   * Get full API endpoint URL
   * @param {string} endpoint - Endpoint key
   * @returns {string} - Full URL
   */
  getEndpointUrl(endpoint) {
    const endpointPath = this.ENDPOINTS[endpoint];
    if (!endpointPath) {
      throw new Error(`Unknown Ekart endpoint: ${endpoint}`);
    }
    return `${this.BASE_URL}${endpointPath}`;
  },

  /**
   * Get authentication URL with client ID as per OpenAPI spec
   * POST /integrations/v2/auth/token/{client_id}
   * @returns {string} - Authentication URL
   */
  getAuthUrl() {
    return `${this.BASE_URL}${this.ENDPOINTS.AUTH_TOKEN}/${this.CLIENT_ID}`;
  },

  /**
   * Get public tracking URL as per OpenAPI spec
   * @param {string} trackingId - Ekart tracking ID
   * @returns {string} - Public tracking URL
   */
  getTrackingUrl(trackingId) {
    return `https://app.elite.ekartlogistics.in/track/${trackingId}`;
  },

  /**
   * Get standard headers for API requests
   * @param {string} token - Access token (optional)
   * @returns {Object} - Headers object
   */
  getHeaders(token = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'RocketryBox-Ekart-Integration/1.0'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  },

  /**
   * Validate shipment data according to Ekart OpenAPI requirements
   * All required fields as per the shipment schema in the OpenAPI spec
   * @param {Object} shipmentData - Shipment data to validate
   * @returns {Object} - Validation result
   */
  validateShipmentData(shipmentData) {
    const errors = [];

    // Required fields from OpenAPI spec schema
    const requiredFields = [
      'tax_value', 'seller_name', 'seller_address', 'seller_gst_tin', 'consignee_gst_amount',
      'order_number', 'invoice_number', 'invoice_date', 'consignee_name', 'payment_mode',
      'category_of_goods', 'products_desc', 'total_amount', 'cod_amount', 'taxable_amount',
      'commodity_value', 'return_reason', 'quantity', 'weight', 'drop_location',
      'pickup_location', 'return_location', 'length', 'height', 'width'
    ];

    requiredFields.forEach(field => {
      if (shipmentData[field] === undefined || shipmentData[field] === null) {
        errors.push(`Missing required field: ${field}`);
      }
    });

    // Validate payment mode enum
    if (shipmentData.payment_mode && !Object.values(this.PAYMENT_MODES).includes(shipmentData.payment_mode)) {
      errors.push(`Invalid payment_mode. Must be one of: ${Object.values(this.PAYMENT_MODES).join(', ')}`);
    }

    // COD amount validation as per OpenAPI spec
    if (shipmentData.payment_mode === this.PAYMENT_MODES.COD) {
      if (!shipmentData.cod_amount || shipmentData.cod_amount <= 0) {
        errors.push('COD amount is required and must be greater than 0 for COD shipments');
      } else if (shipmentData.cod_amount > this.MAX_COD_AMOUNT) {
        errors.push(`COD amount cannot exceed ${this.MAX_COD_AMOUNT}`);
      }
    }

    // Weight validation (minimum 1 gram as per spec)
    if (shipmentData.weight < this.DIMENSION_LIMITS.MIN_WEIGHT) {
      errors.push(`Weight must be at least ${this.DIMENSION_LIMITS.MIN_WEIGHT} grams`);
    }

    // Dimension validation (minimum 1 cm each as per spec)
    ['length', 'width', 'height'].forEach(dim => {
      if (shipmentData[dim] < this.DIMENSION_LIMITS[`MIN_${dim.toUpperCase()}`]) {
        errors.push(`${dim} must be at least ${this.DIMENSION_LIMITS[`MIN_${dim.toUpperCase()}`]} cm`);
      }
    });

    // Total amount validation (must equal taxable_amount + tax_value)
    if (shipmentData.total_amount !== (shipmentData.taxable_amount + shipmentData.tax_value)) {
      errors.push('total_amount must equal taxable_amount + tax_value');
    }

    // Location validation
    ['drop_location', 'pickup_location', 'return_location'].forEach(location => {
      if (shipmentData[location]) {
        if (!shipmentData[location].name || !shipmentData[location].address ||
          !shipmentData[location].phone || !shipmentData[location].pin) {
          errors.push(`${location} must have name, address, phone, and pin fields`);
        }

        // Phone validation (10 digits as per spec)
        if (shipmentData[location].phone &&
          (shipmentData[location].phone < 1000000000 || shipmentData[location].phone > 9999999999)) {
          errors.push(`${location}.phone must be a valid 10-digit number`);
        }
      }
    });

    return {
      isValid: errors.length === 0,
      errors
    };
  },

  /**
   * Transform shipment data to Ekart API format as per OpenAPI specification
   * @param {Object} shipmentDetails - Standard shipment details
   * @returns {Object} - Ekart API formatted data
   */
  transformShipmentData(shipmentDetails) {
    // Calculate tax and total amounts
    const declaredValue = shipmentDetails.declaredValue || shipmentDetails.codAmount || 100;
    const taxValue = Math.round(declaredValue * 0.18); // Assuming 18% GST
    const taxableAmount = declaredValue - taxValue;
    const totalAmount = declaredValue;

    return {
      // Required seller information
      seller_name: shipmentDetails.shipper.name,
      seller_address: `${shipmentDetails.shipper.address.line1 || ''} ${shipmentDetails.shipper.address.line2 || ''}`.trim(),
      seller_gst_tin: shipmentDetails.shipper.gstNumber || '',
      seller_gst_amount: 0,

      // Required consignee information
      consignee_name: shipmentDetails.consignee.name,
      consignee_gst_tin: shipmentDetails.consignee.gstNumber || '',
      consignee_gst_amount: 0,
      integrated_gst_amount: 0,

      // Required order information
      order_number: shipmentDetails.orderNumber || `RB_${Date.now()}`,
      invoice_number: shipmentDetails.invoiceNumber || `INV_${Date.now()}`,
      invoice_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format

      // Required product information
      products_desc: shipmentDetails.commodity || 'General Goods',
      category_of_goods: shipmentDetails.category || 'General',
      hsn_code: shipmentDetails.hsnCode || '9999',

      // Required payment information
      payment_mode: shipmentDetails.cod ? this.PAYMENT_MODES.COD : this.PAYMENT_MODES.PREPAID,
      total_amount: totalAmount,
      tax_value: taxValue,
      taxable_amount: taxableAmount,
      commodity_value: String(taxableAmount),
      cod_amount: shipmentDetails.cod ? (shipmentDetails.codAmount || 0) : 0,

      // Required package information
      quantity: 1,
      weight: Math.round((shipmentDetails.weight || 1) * 1000), // Convert kg to grams
      length: Math.round(shipmentDetails.dimensions?.length || 10),
      height: Math.round(shipmentDetails.dimensions?.height || 10),
      width: Math.round(shipmentDetails.dimensions?.width || 10),

      // Optional return reason (required for reverse shipments)
      return_reason: shipmentDetails.returnReason || '',

      // Required location information as per locationV1 schema
      drop_location: {
        name: shipmentDetails.consignee.name,
        address: `${shipmentDetails.consignee.address.line1 || ''} ${shipmentDetails.consignee.address.line2 || ''}`.trim(),
        city: shipmentDetails.consignee.address.city,
        state: shipmentDetails.consignee.address.state,
        country: 'India',
        phone: parseInt(String(shipmentDetails.consignee.phone).replace(/\D/g, '')),
        pin: parseInt(shipmentDetails.consignee.address.pincode)
      },
      pickup_location: {
        name: shipmentDetails.shipper.name,
        address: `${shipmentDetails.shipper.address.line1 || ''} ${shipmentDetails.shipper.address.line2 || ''}`.trim(),
        city: shipmentDetails.shipper.address.city,
        state: shipmentDetails.shipper.address.state,
        country: 'India',
        phone: parseInt(String(shipmentDetails.shipper.phone).replace(/\D/g, '')),
        pin: parseInt(shipmentDetails.shipper.address.pincode)
      },
      return_location: {
        name: shipmentDetails.shipper.name,
        address: `${shipmentDetails.shipper.address.line1 || ''} ${shipmentDetails.shipper.address.line2 || ''}`.trim(),
        city: shipmentDetails.shipper.address.city,
        state: shipmentDetails.shipper.address.state,
        country: 'India',
        phone: parseInt(String(shipmentDetails.shipper.phone).replace(/\D/g, '')),
        pin: parseInt(shipmentDetails.shipper.address.pincode)
      }
    };
  },

  /**
   * Validate configuration on startup
   * @returns {boolean} - True if valid
   */
  validate() {
    const requiredFields = ['USERNAME', 'PASSWORD', 'CLIENT_ID'];
    const missingFields = requiredFields.filter(field => !this[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing Ekart credentials: ${missingFields.join(', ')}`);
    }

    return true;
  }
};

// Validate configuration on import
try {
  if (EKART_CONFIG.USERNAME && EKART_CONFIG.PASSWORD && EKART_CONFIG.CLIENT_ID) {
    EKART_CONFIG.validate();
  }
} catch (error) {
  console.warn('Ekart configuration validation failed:', error.message);
}

export default EKART_CONFIG;
