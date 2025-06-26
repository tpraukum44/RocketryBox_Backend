import axios from 'axios';
import { EKART_CONFIG } from '../config/ekart.config.js';
import { logger } from '../utils/logger.js';
import { getCache, setCache } from '../utils/redis.js';

/**
 * Enhanced Ekart Logistics Service with Professional Error Handling
 * Updated to match OpenAPI specification v3.8.1 and exact requirements
 * Designed for PaymentController integration with proper response formats
 */
export class EkartService {
  constructor(config = EKART_CONFIG) {
    this.config = config;
    this.requestCache = new Map();
    this.maxRetries = 3;
    this.retryDelay = 2000;
  }

  /**
   * Sanitize and validate phone number to match official Ekart API specification
   * Spec requires: integer, format: int64, minimum: 1000000000, maximum: 9999999999
   * @param {string|number} phone - Phone number to sanitize
   * @returns {string} - Clean 10-digit phone number string (for parseInt conversion)
   */
  sanitizePhoneNumber(phone) {
    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Convert to string and remove all non-digit characters
    let cleanPhone = String(phone).replace(/\D/g, '');

    // Handle different phone number formats
    if (cleanPhone.length === 0) {
      throw new Error('Invalid phone number: no digits found');
    }

    // Remove country code prefixes (91 for India)
    if (cleanPhone.length === 12 && cleanPhone.startsWith('91')) {
      cleanPhone = cleanPhone.substring(2);
    } else if (cleanPhone.length === 13 && cleanPhone.startsWith('+91')) {
      cleanPhone = cleanPhone.substring(3);
    } else if (cleanPhone.length === 11 && cleanPhone.startsWith('0')) {
      // Remove leading 0 from landline numbers
      cleanPhone = cleanPhone.substring(1);
    }

    // Validate final phone number according to official Ekart API spec
    if (cleanPhone.length !== 10) {
      throw new Error(`Invalid phone number length: ${cleanPhone.length} digits. Ekart API requires exactly 10 digits.`);
    }

    // Convert to number and validate range according to official spec
    const phoneNumber = parseInt(cleanPhone);
    if (phoneNumber < 1000000000 || phoneNumber > 9999999999) {
      throw new Error(`Invalid phone number range: ${phoneNumber}. Ekart API requires numbers between 1000000000 and 9999999999.`);
    }

    // Additional validation for Indian mobile numbers (should start with 6-9)
    const firstDigit = cleanPhone.charAt(0);
    if (!['6', '7', '8', '9'].includes(firstDigit)) {
      console.warn(`Phone number ${cleanPhone} may not be a valid Indian mobile number (should start with 6-9)`);
    }

    // Return as integer as required by official Ekart API specification
    return phoneNumber;
  }

  /**
   * Create authenticated API client with enhanced error handling
   * @param {string} token - Access token (optional)
   * @returns {Object} Configured axios instance with interceptors
   */
  createApiClient(token = null) {
    try {
      const client = axios.create({
        baseURL: this.config.BASE_URL,
        timeout: this.config.REQUEST_TIMEOUT,
        headers: this.config.getHeaders(token),
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses
      });

      // Request interceptor for detailed logging (exclude passwords)
      client.interceptors.request.use(
        (config) => {
          const logData = {
            method: config.method?.toUpperCase(),
            url: config.url,
            baseURL: config.baseURL,
            fullUrl: `${config.baseURL}${config.url}`,
            headers: {
              ...config.headers,
              Authorization: config.headers.Authorization ? '[REDACTED]' : undefined
            },
            params: config.params
          };

          // Log request data but exclude password
          if (config.data) {
            const data = typeof config.data === 'string' ? JSON.parse(config.data) : config.data;
            logData.data = { ...data };
            if (logData.data.password) {
              logData.data.password = '[REDACTED]';
            }
          }

          logger.info('🚀 Ekart API Request:', logData);
          return config;
        },
        (error) => {
          logger.error('Request interceptor error:', error);
          return Promise.reject(error);
        }
      );

      // Response interceptor for detailed logging
      client.interceptors.response.use(
        (response) => {
          // 🔥 RAW EKART API RESPONSE LOGGING - EXACTLY WHAT USER WANTS TO SEE
          console.log(`\n=====================================================`);
          console.log(`🔥 RAW EKART API RESPONSE:`);
          console.log(`URL: ${response.config.url}`);
          console.log(`Method: ${response.config.method?.toUpperCase()}`);
          console.log(`Status Code: ${response.status}`);
          console.log(`Status Text: ${response.statusText}`);
          console.log(`Response Headers:`, response.headers);
          console.log(`Response Body:`, response.data);
          console.log(`Full Response:`, JSON.stringify(response.data, null, 2));
          console.log(`=====================================================\n`);

          logger.info('✅ Ekart API Response:', {
            status: response.status,
            statusText: response.statusText,
            url: response.config.url,
            method: response.config.method?.toUpperCase(),
            data: response.data
          });
          return response;
        },
        (error) => {
          // 🔥 RAW EKART ERROR RESPONSE LOGGING
          console.log(`\n=====================================================`);
          console.log(`🔥 RAW EKART API ERROR RESPONSE:`);
          console.log(`URL: ${error.config?.url || 'N/A'}`);
          console.log(`Method: ${error.config?.method?.toUpperCase() || 'N/A'}`);
          console.log(`Status Code: ${error.response?.status || 'N/A'}`);
          console.log(`Status Text: ${error.response?.statusText || 'N/A'}`);
          console.log(`Error Response Headers:`, error.response?.headers || 'N/A');
          console.log(`Error Response Body:`, error.response?.data || 'N/A');
          console.log(`Error Message: ${error.message}`);
          console.log(`Full Error Response:`, JSON.stringify(error.response?.data || {}, null, 2));
          console.log(`=====================================================\n`);

          logger.error('❌ Ekart API Error Response:', {
            status: error.response?.status,
            statusText: error.response?.statusText,
            url: error.config?.url,
            method: error.config?.method?.toUpperCase(),
            rawData: error.response?.data,
            rawMessage: error.message,
            rawHeaders: error.response?.headers
          });

          return Promise.reject(error);
        }
      );

      return client;
    } catch (error) {
      logger.error(`Failed to create Ekart API client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get access token with caching and proper error handling
   * @returns {string} - Access token
   */
  async getAccessToken() {
    const startTime = Date.now();

    try {
      // Check cache first
      const cachedToken = await getCache(this.config.TOKEN_CACHE_KEY);
      if (cachedToken && cachedToken.expires_at > Date.now()) {
        logger.info('Using cached Ekart token');
        return cachedToken.access_token;
      }

      logger.info('Requesting new Ekart authentication token');

      const apiClient = this.createApiClient();
      const authUrl = this.config.getAuthUrl();

      const authPayload = {
        username: this.config.USERNAME,
        password: this.config.PASSWORD
      };

      const response = await apiClient.post(authUrl, authPayload);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('Ekart authentication response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        hasToken: !!response.data?.access_token,
        expiresIn: response.data?.expires_in
      });

      if (response.data && response.data.access_token) {
        const tokenData = {
          access_token: response.data.access_token,
          token_type: response.data.token_type || 'Bearer',
          expires_in: response.data.expires_in,
          expires_at: Date.now() + ((response.data.expires_in - this.config.TOKEN_EXPIRY_BUFFER) * 1000)
        };

        // Cache the token
        await setCache(
          this.config.TOKEN_CACHE_KEY,
          tokenData,
          response.data.expires_in - this.config.TOKEN_EXPIRY_BUFFER
        );

        return response.data.access_token;
      } else {
        throw new Error('No access token received from Ekart API');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`Ekart authentication failed: ${error.message}`, {
        responseTime: `${responseTime}ms`,
        status: error.response?.status,
        data: error.response?.data
      });

      throw new Error(`Ekart authentication failed: ${error.message}`);
    }
  }

  /**
   * Check serviceability for a pincode (V2)
   * @param {string|number} pincode - Pincode to check
   * @returns {Object} - Serviceability information
   */
  async checkServiceability(pincode) {
    const startTime = Date.now();

    try {
      if (!pincode) {
        throw new Error('Invalid pincode provided');
      }

      logger.info(`Ekart serviceability check: ${pincode}`);

      const token = await this.getAccessToken();
      const apiClient = this.createApiClient(token);
      const endpoint = `${this.config.ENDPOINTS.SERVICEABILITY_V2}/${pincode}`;

      const response = await apiClient.get(endpoint);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('Ekart serviceability response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        serviceable: response.data?.status
      });

      if (response.data) {
        return {
          success: true,
          pincode: pincode,
          serviceable: response.data.status,
          details: response.data.details,
          message: response.data.remark,
          responseTime: responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error('Invalid response from Ekart serviceability API');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`Ekart serviceability check failed: ${error.message}`, {
        pincode,
        responseTime: `${responseTime}ms`
      });

      return {
        success: false,
        pincode: pincode,
        serviceable: false,
        error: error.message,
        responseTime: responseTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Register warehouse with Ekart (alias for autoRegisterPickupAddress)
   * @param {Object} warehouseData - Warehouse data object
   * @returns {Object} - Registration result with alias
   */
  async registerWarehouse(warehouseData) {
    console.log('🏭 Ekart Warehouse Registration Called');
    console.log('Input warehouseData:', JSON.stringify(warehouseData, null, 2));

    // Transform warehouse data to pickup address format expected by autoRegisterPickupAddress
    const pickupAddress = {
      name: warehouseData.name || warehouseData.alias,
      phone: warehouseData.phone || warehouseData.contactPhone,
      address: {
        line1: warehouseData.address || warehouseData.addressLine1,
        line2: warehouseData.landmark || '',
        city: warehouseData.city,
        state: warehouseData.state,
        pincode: warehouseData.pincode,
        country: warehouseData.country || 'India'
      }
    };

    console.log('Transformed to pickupAddress format:', JSON.stringify(pickupAddress, null, 2));

    // Use the existing autoRegisterPickupAddress method
    const result = await this.autoRegisterPickupAddress(pickupAddress);

    // Add additional fields expected by registration service
    if (result.success) {
      result.addressId = result.alias; // Some services expect addressId
      result.timestamp = new Date().toISOString();
    }

    return result;
  }

  /**
   * Auto-register pickup address with Ekart - Returns raw API responses
   * @param {Object} pickupAddress - Pickup address object
   * @returns {Object} - Registration result with alias
   */
  async autoRegisterPickupAddress(pickupAddress) {
    try {
      console.log('🔍 DETAILED ADDRESS REGISTRATION DEBUG:');
      console.log('=====================================');
      console.log('1. Raw input:', pickupAddress);
      console.log('2. Type:', typeof pickupAddress);
      console.log('3. Is null/undefined:', pickupAddress === null || pickupAddress === undefined);
      console.log('4. Keys:', pickupAddress ? Object.keys(pickupAddress) : 'NO_KEYS');
      console.log('5. Has address property:', 'address' in (pickupAddress || {}));
      console.log('6. Address value:', pickupAddress?.address);
      console.log('7. Address type:', typeof pickupAddress?.address);

      if (pickupAddress?.address) {
        console.log('8. Address keys:', Object.keys(pickupAddress.address));
        console.log('9. Address.pincode:', pickupAddress.address.pincode);
        console.log('10. Address.line1:', pickupAddress.address.line1);
      }

      // Validate input data exists
      if (!pickupAddress) {
        console.log('❌ FAILED: pickupAddress is null/undefined');
        return {
          success: false,
          error: "Pickup address is required",
          alias: 'MISSING_ADDRESS'
        };
      }

      if (!pickupAddress.address) {
        console.log('❌ FAILED: pickupAddress.address is null/undefined');
        console.log('Available keys in pickupAddress:', Object.keys(pickupAddress));
        return {
          success: false,
          error: "Pickup address.address is required",
          alias: 'MISSING_ADDRESS_OBJECT'
        };
      }

      if (!pickupAddress.address.pincode) {
        console.log('❌ FAILED: pickupAddress.address.pincode is missing');
        console.log('Available keys in address:', Object.keys(pickupAddress.address));
        return {
          success: false,
          error: "Pickup address pincode is required",
          alias: 'MISSING_PINCODE'
        };
      }

      console.log('✅ INPUT VALIDATION PASSED');

      // Create unique alias from pickup address
      const timestamp = Date.now().toString().slice(-6);
      const alias = `RB_${pickupAddress.address.pincode}_${timestamp}`;

      // Build official Ekart address registration payload per API docs
      const addressData = {
        alias: alias,
        phone: this.sanitizePhoneNumber(pickupAddress.phone || '9999999999'),
        address_line1: pickupAddress.address.line1 || 'Address Line 1',
        address_line2: pickupAddress.address.line2 || '',
        pincode: parseInt(pickupAddress.address.pincode),
        city: pickupAddress.address.city || 'City',
        state: pickupAddress.address.state || 'State',
        country: 'India'
      };

      console.log('📋 FINAL PAYLOAD (per Ekart API docs):');
      console.log('======================================');
      console.log(JSON.stringify(addressData, null, 2));

      // Get token and call registration API
      const token = await this.getAccessToken();
      const apiClient = this.createApiClient(token);
      const endpoint = this.config.ENDPOINTS.ADD_ADDRESS;

      try {
        const response = await apiClient.post(endpoint, addressData);

        // Registration successful
        return {
          success: true,
          alias: alias,
          rawResponse: response.data
        };

      } catch (error) {
        // Check if address already exists (common case)
        const errorMsg = error.response?.data?.message || '';
        if (error.response?.status === 400 &&
          (errorMsg.includes('already') || errorMsg.includes('exists') || errorMsg.includes('duplicate'))) {

          // Address exists - return success with alias
          return {
            success: true,
            alias: alias,
            rawResponse: { message: 'Address already exists', existing: true }
          };
        }

        // Registration failed - return failure
        return {
          success: false,
          error: error.response?.data || error.message,
          alias: alias
        };
      }

    } catch (error) {
      return {
        success: false,
        error: error.message,
        alias: 'FAILED_TO_GENERATE'
      };
    }
  }

  /**
   * Create shipment with Ekart - Returns raw API response directly
   * @param {Object} orderData - Order data from PaymentController
   * @returns {Object} - Raw API response from Ekart
   */
  async createShipment(orderData) {
    try {
      console.log('🔍 COMPREHENSIVE DEBUG - EKART SERVICE INPUT');
      console.log('============================================');
      console.log('1. Raw orderData:', JSON.stringify(orderData, null, 2));
      console.log('2. Type:', typeof orderData);
      console.log('3. Keys:', orderData ? Object.keys(orderData) : 'NO_KEYS');

      // Validate input data exists
      if (!orderData) {
        return {
          statusCode: 400,
          message: "ORDER_DATA_REQUIRED",
          description: "Order data is required for shipment creation"
        };
      }

      // Try to find pickup address in various possible keys
      let pickupAddress = orderData.pickupAddress || orderData.pickup || orderData.shipper || orderData.sender;

      console.log('4. Found pickup address:', !!pickupAddress);
      console.log('5. Pickup address data:', JSON.stringify(pickupAddress, null, 2));

      if (!pickupAddress) {
        console.log('❌ NO PICKUP ADDRESS FOUND in any expected keys');
        console.log('Available keys:', Object.keys(orderData));
        return {
          statusCode: 400,
          message: "PICKUP_ADDRESS_REQUIRED",
          description: "Pickup address not found. Expected keys: pickupAddress, pickup, shipper, or sender"
        };
      }

      console.log('🔥 EKART SHIPMENT CREATION PROCESS STARTED');
      console.log('==========================================');

      // STEP 1: MANDATORY ADDRESS REGISTRATION BEFORE SHIPMENT CREATION
      console.log('📍 STEP 1: Registering pickup address BEFORE shipment creation...');
      const registrationResult = await this.autoRegisterPickupAddress(pickupAddress);

      if (!registrationResult.success) {
        console.log('❌ STEP 1 FAILED: Address registration failed - STOPPING process');
        return {
          statusCode: 400,
          message: "ADDRESS_REGISTRATION_FAILED",
          description: registrationResult.error || "Pickup address registration failed"
        };
      }

      console.log('✅ STEP 1 SUCCESS: Address registered with alias:', registrationResult.alias);
      console.log('📦 STEP 2: Proceeding to shipment creation with registered address...');

      // Get access token for shipment creation
      const token = await this.getAccessToken();
      const apiClient = this.createApiClient(token);
      const endpoint = this.config.ENDPOINTS.CREATE_SHIPMENT;

      // Try to find delivery address in various possible keys
      let deliveryAddress = orderData.deliveryAddress || orderData.delivery || orderData.consignee || orderData.recipient || orderData.customer;

      console.log('6. Found delivery address:', !!deliveryAddress);
      console.log('7. Delivery address data:', JSON.stringify(deliveryAddress, null, 2));

      // Build proper Ekart API payload format
      const isReverse = orderData.isReverse || orderData.returnReason;
      const paymentMode = isReverse ? 'Pickup' : (orderData.cod ? 'COD' : 'Prepaid');
      const totalAmount = orderData.totalAmount || orderData.amount || orderData.value || 100;
      const taxValue = Math.round(totalAmount * 0.18); // 18% GST
      const taxableAmount = totalAmount - taxValue;
      const codAmount = paymentMode === 'COD' ? totalAmount : 0;

      const ekartPayload = {
        // Required seller information
        seller_name: pickupAddress?.name || 'RocketryBox Sender',
        seller_address: `${pickupAddress?.address?.line1 || pickupAddress?.address1 || ''} ${pickupAddress?.address?.line2 || pickupAddress?.address2 || ''}`.trim(),
        seller_gst_tin: pickupAddress?.gstNumber || '',
        seller_gst_amount: 0,

        // Required consignee information
        consignee_name: deliveryAddress?.name || 'Customer',
        consignee_gst_tin: deliveryAddress?.gstNumber || '',
        consignee_gst_amount: 0,
        integrated_gst_amount: 0,

        // Required order information
        order_number: orderData.orderId || orderData.orderNumber || orderData.id || `RB_${Date.now()}`,
        invoice_number: `INV_${orderData.orderId || orderData.orderNumber || Date.now()}`,
        invoice_date: new Date().toISOString().split('T')[0],

        // Required product information
        products_desc: orderData.productDescription || orderData.description || 'General Goods',
        category_of_goods: orderData.category || 'General',
        hsn_code: orderData.hsnCode || '9999',

        // Required payment information
        payment_mode: paymentMode,
        total_amount: totalAmount,
        tax_value: taxValue,
        taxable_amount: taxableAmount,
        commodity_value: String(taxableAmount),
        cod_amount: codAmount,

        // Required package information
        quantity: 1,
        weight: Math.round((orderData.packageDetails?.weight || orderData.package?.weight || orderData.weight || 1) * 1000),
        length: Math.round(orderData.packageDetails?.dimensions?.length || orderData.package?.dimensions?.length || orderData.length || 10),
        height: Math.round(orderData.packageDetails?.dimensions?.height || orderData.package?.dimensions?.height || orderData.height || 10),
        width: Math.round(orderData.packageDetails?.dimensions?.width || orderData.package?.dimensions?.width || orderData.width || 10),

        // Return reason
        return_reason: isReverse ? (orderData.returnReason || 'Product return') : 'No return applicable',

        // Drop location
        drop_location: {
          name: deliveryAddress?.name || 'Customer',
          address: `${deliveryAddress?.address?.line1 || deliveryAddress?.address1 || ''} ${deliveryAddress?.address?.line2 || deliveryAddress?.address2 || ''}`.trim(),
          city: deliveryAddress?.address?.city || deliveryAddress?.city || '',
          state: deliveryAddress?.address?.state || deliveryAddress?.state || '',
          country: deliveryAddress?.address?.country || deliveryAddress?.country || 'India',
          phone: this.sanitizePhoneNumber(deliveryAddress?.phone || '9999999999'),
          pin: parseInt(deliveryAddress?.address?.pincode || deliveryAddress?.pincode || '110001')
        },

        // Pickup location - use registered alias
        pickup_location: {
          name: registrationResult.alias // Use registered address alias
        },

        // Return location - use registered alias
        return_location: {
          name: registrationResult.alias // Use registered address alias
        }
      };

      console.log('🚀 STEP 3: Calling Ekart API with REGISTERED address alias:', registrationResult.alias);

      // Call API with proper payload and return raw response
      const response = await apiClient.put(endpoint, ekartPayload);

      console.log('✅ EKART API CALL COMPLETED - Raw response received');
      return response.data;

    } catch (error) {
      // Return raw API response without any wrappers
      if (error.response) {
        return error.response.data;
      }

      // For non-API errors, return in similar format
      return {
        statusCode: 500,
        message: "INTERNAL_ERROR",
        description: error.message || "An internal error occurred"
      };
    }
  }

  /**
   * Cancel shipment with Ekart
   * @param {string} trackingId - Ekart tracking ID
   * @returns {Object} - Cancellation response
   */
  async cancelShipment(trackingId) {
    const startTime = Date.now();

    try {
      if (!trackingId) {
        throw new Error('Tracking ID is required for cancellation');
      }

      logger.info('🗑️ Ekart shipment cancellation request:', { trackingId });

      const token = await this.getAccessToken();
      const apiClient = this.createApiClient(token);
      const endpoint = this.config.ENDPOINTS.CANCEL_SHIPMENT;

      // Add retry logic for network timeouts
      let lastError;
      const maxRetries = 2;

      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 Ekart cancellation attempt ${attempt}/${maxRetries} for tracking ID: ${trackingId}`);

          const response = await apiClient.delete(endpoint, {
            params: { tracking_id: trackingId },
            timeout: 15000 // 15 second timeout per attempt
          });

          // Log raw response for debugging
          console.log('🔍 EKART CANCELLATION RAW RESPONSE:', JSON.stringify(response.data, null, 2));

          // Handle different possible response formats from Ekart
          const responseData = response.data;

          // Check for success indicators (can be status: true or success: true or HTTP 200 with data)
          const isSuccess = responseData?.status === true ||
            responseData?.success === true ||
            (response.status === 200 && responseData && !responseData.error);

          if (isSuccess) {
            logger.info('✅ Ekart shipment cancelled successfully:', {
              trackingId,
              attempt,
              responseTime: `${responseTime}ms`
            });

            return {
              success: true,
              trackingId: trackingId,
              message: responseData.remark || responseData.message || 'Shipment cancelled successfully',
              rawResponse: responseData,
              responseTime: responseTime,
              attempt: attempt,
              timestamp: new Date().toISOString()
            };
          } else {
            // Collect error details from various possible response formats
            const errorMessage = responseData?.remark ||
              responseData?.message ||
              responseData?.error ||
              responseData?.description ||
              'Cancellation failed - no specific reason provided';

            throw new Error(errorMessage);
          }

        } catch (attemptError) {
          lastError = attemptError;
          const currentTime = Date.now();
          const attemptDuration = currentTime - startTime;

          console.log(`❌ Ekart cancellation attempt ${attempt} failed:`, {
            trackingId,
            error: attemptError.message,
            duration: `${attemptDuration}ms`,
            isTimeout: attemptError.code === 'ETIMEDOUT' || attemptError.message.includes('timeout'),
            willRetry: attempt < maxRetries
          });

          // If this is the last attempt or not a timeout, don't retry
          if (attempt === maxRetries || (!attemptError.code?.includes('ETIMEDOUT') && !attemptError.message.includes('timeout'))) {
            break;
          }

          // Wait before retry (exponential backoff)
          const waitTime = 2000 * attempt; // 2s, 4s, 6s...
          console.log(`⏳ Waiting ${waitTime}ms before retry...`);
          await new Promise(resolve => setTimeout(resolve, waitTime));
        }
      }

      // All attempts failed
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      throw lastError;

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      // Log detailed error information
      logger.error('❌ Ekart shipment cancellation failed:', {
        trackingId,
        error: error.message,
        responseTime: `${responseTime}ms`,
        responseStatus: error.response?.status,
        responseData: error.response?.data
      });

      return {
        success: false,
        trackingId: trackingId,
        error: error.message,
        rawError: error.response?.data,
        responseTime: responseTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Track shipment with Ekart (no authentication required)
   * @param {string} trackingId - Ekart tracking ID
   * @returns {Object} - Tracking information
   */
  async trackShipment(trackingId) {
    const startTime = Date.now();

    try {
      if (!trackingId) {
        throw new Error('Tracking ID is required');
      }

      logger.info('📍 Ekart tracking request:', { trackingId });

      // Note: Tracking API is open and doesn't require authentication
      const apiClient = this.createApiClient();
      const endpoint = `${this.config.ENDPOINTS.TRACK_SHIPMENT}/${trackingId}`;

      const response = await apiClient.get(endpoint);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      if (response.data && response.data.track) {
        const trackData = response.data.track;

        logger.info('✅ Ekart tracking successful:', {
          trackingId,
          status: trackData.status,
          responseTime: `${responseTime}ms`
        });

        return {
          success: true,
          trackingId: trackingId,
          status: trackData.status,
          statusDetail: trackData.desc,
          currentLocation: trackData.location,
          lastUpdated: new Date(trackData.ctime).toISOString(),
          pickupTime: trackData.pickupTime ? new Date(trackData.pickupTime).toISOString() : null,
          estimatedDelivery: response.data.edd ? new Date(response.data.edd).toISOString() : null,
          attempts: trackData.attempts || 0,
          ndrStatus: trackData.ndrStatus,
          ndrActions: trackData.ndrActions || [],
          trackingHistory: trackData.details || [],
          courierName: 'Ekart Logistics',
          orderNumber: response.data.order_number,
          trackingUrl: this.config.getTrackingUrl(trackingId),
          responseTime: responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error('No tracking data found for this tracking ID');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error('❌ Ekart tracking failed:', {
        trackingId,
        error: error.message,
        responseTime: `${responseTime}ms`
      });

      return {
        success: false,
        trackingId: trackingId,
        error: error.message,
        responseTime: responseTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get pricing estimates (V3 Serviceability with pricing)
   * @param {Object} estimateData - Estimate request data
   * @returns {Object} - Pricing estimates
   */
  async getPricingEstimate(estimateData) {
    const startTime = Date.now();

    try {
      logger.info('💰 Ekart pricing estimate request:', estimateData);

      const token = await this.getAccessToken();
      const apiClient = this.createApiClient(token);
      const endpoint = this.config.ENDPOINTS.ESTIMATE_PRICING;

      const payload = {
        pickupPincode: parseInt(estimateData.pickupPincode),
        dropPincode: parseInt(estimateData.dropPincode),
        invoiceAmount: estimateData.invoiceAmount || 100,
        weight: estimateData.weight || 1,
        length: estimateData.length || 10,
        height: estimateData.height || 10,
        width: estimateData.width || 10,
        serviceType: estimateData.serviceType || 'SURFACE',
        codAmount: estimateData.codAmount || 0
      };

      const response = await apiClient.post(endpoint, payload);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('Ekart pricing estimate response:', {
        status: response.status,
        responseTime: `${responseTime}ms`
      });

      if (response.data) {
        return {
          success: true,
          estimate: response.data,
          responseTime: responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error('Invalid response from Ekart pricing API');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`Ekart pricing estimate failed: ${error.message}`, {
        estimateData,
        responseTime: `${responseTime}ms`
      });

      return {
        success: false,
        error: error.message,
        responseTime: responseTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create order (alias for createShipment for test compatibility)
   * @param {Object} orderData - Order data
   * @returns {Object} - Shipment creation response
   */
  async createOrder(orderData) {
    return await this.createShipment(orderData);
  }

  /**
   * Health check for Ekart service
   * @returns {Object} - Health status
   */
  async getHealthStatus() {
    try {
      logger.info('Performing Ekart service health check');

      // Test authentication
      const token = await this.getAccessToken();

      if (token && typeof token === 'string') {
        return {
          status: 'HEALTHY',
          message: 'Ekart service is operational',
          details: {
            authentication: 'SUCCESS',
            apiEndpoint: this.config.BASE_URL,
            clientId: this.config.CLIENT_ID,
            hasCredentials: !!(this.config.USERNAME && this.config.PASSWORD)
          },
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error('Authentication failed');
      }

    } catch (error) {
      logger.error(`Ekart health check failed: ${error.message}`);

      return {
        status: 'UNHEALTHY',
        message: 'Ekart service has issues',
        error: error.message,
        details: {
          authentication: 'FAILED',
          apiEndpoint: this.config.BASE_URL,
          clientId: this.config.CLIENT_ID,
          hasCredentials: !!(this.config.USERNAME && this.config.PASSWORD)
        },
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const ekartService = new EkartService();
export default ekartService;
