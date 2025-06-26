import 'dotenv/config';

/**
 * XpressBees API Configuration
 * Professional integration with authentication and endpoint management
 * Rate calculation handled via MongoDB rate cards (not API)
 */
export const XPRESSBEES_CONFIG = {
  // API Base Configuration - Production URL Only
  API_BASE_URL: 'https://ship.xpressbees.com',

  // TEST MODE - DISABLED: Always use real API calls
  TEST_MODE: false,

  // API Endpoints
  ENDPOINTS: {
    // Authentication
    LOGIN: '/api/users/franchise_login',

    // Courier Management
    COURIER_LIST: '/api/franchise/shipments/courier',

    // Shipment Operations
    CREATE_SHIPMENT: '/api/franchise/shipments',
    CANCEL_SHIPMENT: '/api/franchise/shipments/cancel_shipment',
    TRACK_SHIPMENT: '/api/franchise/shipments/track_shipment',
    PICKUP_SHIPMENT: '/api/franchise/shipments/pickup',

    // Note: Rate calculation handled via MongoDB rate cards, not API

    // NDR (Non-Delivery Report) Operations
    NDR_LIST: '/api/franchise/ndr',
    NDR_CREATE: '/api/franchise/ndr/create'
  },

  // Authentication Credentials
  AUTH: {
    EMAIL: process.env.XPRESSBEES_EMAIL || 'billing@rocketrybox.in',
    PASSWORD: process.env.XPRESSBEES_PASSWORD || 'XB@1234'
  },

  // Service Types (Based on API documentation and live API response)
  SERVICE_TYPES: {
    B2C_STANDARD: { id: '16789', name: 'ROCKETRY BOX PRIVATE LIMITED FRANCHISE B2C', type: 'standard' },
    B2C_AIR: { id: '16790', name: 'ROCKETRY BOX PRIVATE LIMITED FRANCHISE B2C AIR', type: 'express' },
    B2B_STANDARD: { id: '16791', name: 'ROCKETRY BOX PRIVATE LIMITED FRANCHISE B2B', type: 'b2b' }
  },

  // Payment Methods
  PAYMENT_METHODS: {
    COD: 'COD',
    PREPAID: 'prepaid'
  },

  // Pickup Locations
  PICKUP_LOCATIONS: {
    CUSTOMER: 'customer',
    FRANCHISE: 'franchise'
  },

  // Shipping Configuration
  DEFAULT_SETTINGS: {
    ORDER_TYPE_USER: 'ecom',
    PICKUP_LOCATION: 'franchise',
    UNIQUE_ORDER_NUMBER: 'yes',
    MAX_WEIGHT_KG: 50, // Maximum weight in kg
    DIMENSIONAL_FACTOR: 5000 // (L*W*H)/5000 for volumetric weight
  },

  // Request Configuration
  REQUEST_TIMEOUT: 30000, // 30 seconds
  TOKEN_CACHE_DURATION: 3600000, // 1 hour in milliseconds

  // Rate Configuration
  PRICING: {
    BASE_RATE: 30,
    COD_CHARGES: 25,
    FUEL_SURCHARGE_PERCENT: 10,
    SERVICE_TAX_PERCENT: 18
  },

  // Environment Settings
  IS_DEVELOPMENT: process.env.NODE_ENV === 'development',
  IS_PRODUCTION: process.env.NODE_ENV === 'production',

  /**
   * Get API headers for requests
   * @param {string} token - Bearer token (optional)
   * @returns {Object} Headers object
   */
  getHeaders(token = null) {
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'RocketryBox-XpressBees-Integration/1.0'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  },

  /**
   * Get service type details by ID or type
   * @param {string} identifier - Service ID or type
   * @returns {Object} Service type object
   */
  getServiceType(identifier) {
    // Search by ID first
    const byId = Object.values(this.SERVICE_TYPES).find(service => service.id === identifier);
    if (byId) return byId;

    // Search by type
    const byType = Object.values(this.SERVICE_TYPES).find(service => service.type === identifier);
    if (byType) return byType;

    // Default to B2C Surface (standard)
    return this.SERVICE_TYPES.B2C_STANDARD;
  },

  /**
   * Get full API URL
   * @param {string} endpoint - Endpoint path
   * @returns {string} Full URL
   */
  getApiUrl(endpoint) {
    return `${this.API_BASE_URL}${endpoint}`;
  },

  /**
   * Convert weight from kg to grams
   * @param {number} weightKg - Weight in kg
   * @returns {number} Weight in grams
   */
  convertToGrams(weightKg) {
    return Math.round(weightKg * 1000);
  },

  /**
   * Calculate volumetric weight
   * @param {Object} dimensions - Package dimensions {length, width, height} in cm
   * @returns {number} Volumetric weight in kg
   */
  calculateVolumetricWeight(dimensions) {
    const { length = 10, width = 10, height = 10 } = dimensions;
    return Math.ceil((length * width * height) / this.DEFAULT_SETTINGS.DIMENSIONAL_FACTOR);
  },

  /**
   * Get chargeable weight (higher of actual and volumetric)
   * @param {number} actualWeight - Actual weight in kg
   * @param {Object} dimensions - Package dimensions
   * @returns {number} Chargeable weight in kg
   */
  getChargeableWeight(actualWeight, dimensions) {
    const volumetricWeight = this.calculateVolumetricWeight(dimensions);
    return Math.max(actualWeight, volumetricWeight);
  },

  /**
   * Generate unique order ID
   * @param {string} prefix - Optional prefix
   * @returns {string} Unique order ID
   */
  generateOrderId(prefix = 'XB') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    return `${prefix}${timestamp}${random}`;
  },

  /**
   * Validate configuration
   * @returns {boolean} True if valid
   */
  validate() {
    if (!this.AUTH.EMAIL || !this.AUTH.PASSWORD) {
      throw new Error('XpressBees email and password are required');
    }

    if (!this.AUTH.EMAIL.includes('@')) {
      throw new Error('XpressBees email format is invalid');
    }

    if (!this.API_BASE_URL.startsWith('https://')) {
      throw new Error('XpressBees API base URL must be HTTPS');
    }

    return true;
  },

  /**
   * Get tracking URL
   * @param {string} awb - AWB number
   * @returns {string} Tracking URL
   */
  getTrackingUrl(awb) {
    return `https://www.xpressbees.com/track/${awb}`;
  }
};

// Validate configuration on import
try {
  XPRESSBEES_CONFIG.validate();
} catch (error) {
  // Silent validation failure
}

export default XPRESSBEES_CONFIG;
