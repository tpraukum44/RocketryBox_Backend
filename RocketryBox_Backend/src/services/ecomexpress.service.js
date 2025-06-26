import axios from 'axios';
import { ECOMEXPRESS_CONFIG } from '../config/ecomexpress.config.js';
import { logger } from '../utils/logger.js';

/**
 * EcomExpress Service with Professional API Integration
 * Created for consistency with BlueDart implementation
 * Provides a clean service layer for EcomExpress operations
 */
export class EcomExpressService {
  constructor(config = ECOMEXPRESS_CONFIG) {
    this.config = config;
    this.requestCache = new Map();
  }

  /**
   * Create authenticated API client for specific endpoint type
   * @param {string} serviceType - Service type (standard, express, economy)
   * @param {string} endpointType - Endpoint type (API, SHIPMENT, TRACKING)
   * @returns {Object} Configured axios instance
   */
  createApiClient(serviceType = 'standard', endpointType = 'API') {
    try {
      const shipperDetails = this.config.getShipperDetails(serviceType);
      const baseUrl = this.config.getBaseUrl(endpointType);

      return axios.create({
        baseURL: baseUrl,
        timeout: this.config.REQUEST_TIMEOUT,
        headers: this.config.getHeaders(),
        validateStatus: (status) => status < 500 // Accept 4xx as valid responses
      });
    } catch (error) {
      logger.error(`Failed to create EcomExpress API client: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check pincode serviceability
   * @param {string} pincode - Pincode to check
   * @param {string} serviceType - Service type
   * @returns {Object} - Serviceability information
   */
  async checkPincodeServiceability(pincode, serviceType = 'standard') {
    const startTime = Date.now();

    try {
      logger.info(`EcomExpress pincode serviceability check: ${pincode} for service: ${serviceType}`);

      // Check cache first
      const cacheKey = `pincode_${pincode}_${serviceType}`;
      if (this.requestCache.has(cacheKey)) {
        const cached = this.requestCache.get(cacheKey);
        if (Date.now() - cached.timestamp < 300000) { // 5 minutes cache
          logger.info('Returning cached pincode serviceability result');
          return cached.data;
        }
      }

      const apiClient = this.createApiClient(serviceType, 'API');
      const endpoint = this.config.getEndpoint('PINCODE_CHECK');

      const formData = this.config.createAuthenticatedFormData(serviceType, {
        pincode: pincode
      });

      const response = await apiClient.post(endpoint, formData);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('EcomExpress pincode check response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        hasData: !!response.data
      });

      let serviceabilityResult;

      if (response.status === 200) {
        const responseData = response.data;

        // Handle different response formats
        if (responseData && (responseData.status === true || responseData.success === true || responseData.status === 1)) {
          serviceabilityResult = {
            success: true,
            serviceable: true,
            cod_available: responseData.cod_available !== false,
            pickup_available: responseData.pickup_available !== false,
            prepaid_available: responseData.prepaid_available !== false,
            responseTime: responseTime
          };
        } else if (Array.isArray(responseData) && responseData.length > 0) {
          const pincodeData = responseData.find(item => item.pincode === pincode);
          serviceabilityResult = {
            success: true,
            serviceable: !!pincodeData,
            cod_available: pincodeData?.cod_available !== false,
            pickup_available: pincodeData?.pickup_available !== false,
            prepaid_available: pincodeData?.prepaid_available !== false,
            responseTime: responseTime
          };
        } else {
          // Default to serviceable if API returns 200
          serviceabilityResult = {
            success: true,
            serviceable: true,
            cod_available: true,
            pickup_available: true,
            prepaid_available: true,
            message: 'API returned 200 - assuming serviceable',
            responseTime: responseTime
          };
        }
      } else {
        serviceabilityResult = {
          success: true,
          serviceable: false,
          message: `API returned status ${response.status}`,
          responseTime: responseTime
        };
      }

      // Cache the result
      this.requestCache.set(cacheKey, {
        timestamp: Date.now(),
        data: serviceabilityResult
      });

      return serviceabilityResult;

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`EcomExpress pincode check failed: ${error.message}`, {
        pincode,
        serviceType,
        responseTime: `${responseTime}ms`,
        status: error.response?.status
      });

      // Graceful error handling
      if (error.response?.status === 401) {
        throw new Error('Authentication failed - please check credentials');
      }

      if (error.response?.status >= 500) {
        // Server error - assume serviceable
        return {
          success: true,
          serviceable: true,
          cod_available: true,
          pickup_available: true,
          prepaid_available: true,
          message: 'API temporarily unavailable - assuming serviceable',
          apiError: error.message,
          responseTime: responseTime
        };
      }

      throw error;
    }
  }

  /**
   * Fetch AWB number
   * @param {Object} shipmentDetails - Shipment details
   * @param {string} serviceType - Service type
   * @returns {Object} - AWB response
   */
  async fetchAWB(shipmentDetails, serviceType = 'standard') {
    const startTime = Date.now();

    try {
      logger.info('EcomExpress AWB fetch request:', { serviceType });

      const isExpressPlus = serviceType === 'express';
      const endpointType = isExpressPlus ? 'SHIPMENT' : 'API';
      const endpointName = isExpressPlus ? 'FETCH_AWB_V2' : 'FETCH_AWB';

      const apiClient = this.createApiClient(serviceType, endpointType);
      const endpoint = this.config.getEndpoint(endpointName);

      const formData = this.config.createAuthenticatedFormData(serviceType, {
        count: 1,
        type: isExpressPlus ? 'EXPP' : 'PPD'
      });

      const response = await apiClient.post(endpoint, formData);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('EcomExpress AWB fetch response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        hasAWB: !!response.data?.awb
      });

      if (response.data && response.data.awb) {
        const shipperDetails = this.config.getShipperDetails(serviceType);
        return {
          success: true,
          awb: response.data.awb,
          shipperCode: shipperDetails.CODE,
          responseTime: responseTime
        };
      }

      throw new Error(response.data?.reason || 'Failed to fetch AWB from EcomExpress');

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`EcomExpress AWB fetch failed: ${error.message}`, {
        serviceType,
        responseTime: `${responseTime}ms`
      });

      return {
        success: false,
        error: error.message,
        responseTime: responseTime
      };
    }
  }

  /**
   * Book a shipment
   * @param {Object} shipmentDetails - Shipment details
   * @returns {Object} - Booking response
   */
  async bookShipment(shipmentDetails) {
    const startTime = Date.now();

    try {
      logger.info('EcomExpress shipment booking request');

      // Validate required shipment details
      if (!shipmentDetails) {
        throw new Error('Shipment details are required');
      }
      if (!shipmentDetails.consignee || !shipmentDetails.consignee.address) {
        throw new Error('Consignee details and address are required');
      }
      if (!shipmentDetails.shipper || !shipmentDetails.shipper.address) {
        throw new Error('Shipper details and address are required');
      }

      // First, fetch AWB number
      const awbResponse = await this.fetchAWB(shipmentDetails, shipmentDetails.serviceType);

      if (!awbResponse.success) {
        throw new Error('Failed to fetch AWB number');
      }

      const isExpressPlus = shipmentDetails.serviceType === 'express';
      const endpointType = isExpressPlus ? 'SHIPMENT' : 'API';
      const endpointName = isExpressPlus ? 'MANIFEST_V2' : 'MANIFEST';

      const apiClient = this.createApiClient(shipmentDetails.serviceType, endpointType);
      const endpoint = this.config.getEndpoint(endpointName);

      // Prepare manifest parameters
      const manifestParams = {
        awb: awbResponse.awb,
        name: shipmentDetails.consignee.name,
        add: shipmentDetails.consignee.address.line1,
        pin: shipmentDetails.consignee.address.pincode,
        mobile: shipmentDetails.consignee.phone,
        alt_mobile: shipmentDetails.consignee.alternatePhone || '',
        email: shipmentDetails.consignee.email || '',
        state: shipmentDetails.consignee.address.state,
        city: shipmentDetails.consignee.address.city,
        product_type: isExpressPlus ? 'EXPP' : 'PPD',
        order_type: shipmentDetails.cod ? 'COD' : 'PPD',
        piece: 1,
        weight: shipmentDetails.weight,
        declared_value: shipmentDetails.declaredValue || 100,
        cod_amount: shipmentDetails.cod ? shipmentDetails.codAmount : 0,
        length: shipmentDetails.dimensions?.length || 10,
        breadth: shipmentDetails.dimensions?.width || 10,
        height: shipmentDetails.dimensions?.height || 10,
        pickup_name: shipmentDetails.shipper.name,
        pickup_add: shipmentDetails.shipper.address.line1,
        pickup_pin: shipmentDetails.shipper.address.pincode,
        pickup_mobile: shipmentDetails.shipper.phone,
        pickup_email: shipmentDetails.shipper.email || '',
        return_name: shipmentDetails.shipper.name,
        return_add: shipmentDetails.shipper.address.line1,
        return_pin: shipmentDetails.shipper.address.pincode,
        return_mobile: shipmentDetails.shipper.phone,
        return_email: shipmentDetails.shipper.email || '',
        invoice_number: shipmentDetails.invoiceNumber || shipmentDetails.referenceNumber,
        invoice_date: new Date().toISOString().split('T')[0],
        invoice_amount: shipmentDetails.declaredValue || 100,
        commodity: shipmentDetails.commodity || 'General Goods'
      };

      const formData = this.config.createAuthenticatedFormData(shipmentDetails.serviceType, manifestParams);

      const response = await apiClient.post(endpoint, formData);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('EcomExpress booking response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        success: !!response.data?.success
      });

      if (response.data && response.data.success) {
        const shipperDetails = this.config.getShipperDetails(shipmentDetails.serviceType);

        return {
          success: true,
          awb: awbResponse.awb,
          trackingUrl: this.config.getTrackingUrl(awbResponse.awb),
          courierName: 'Ecom Express',
          serviceType: shipmentDetails.serviceType,
          shipperCode: shipperDetails.CODE,
          bookingType: 'API_AUTOMATED',
          message: 'Shipment booked successfully via EcomExpress API',
          responseTime: responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(response.data?.reason || 'EcomExpress booking failed');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`EcomExpress booking failed: ${error.message}`, {
        responseTime: `${responseTime}ms`,
        error: error.response?.data || error.message
      });

      // Return proper error - NO TEMPORARY AWBs
      return {
        success: false,
        error: `EcomExpress API booking failed: ${error.message}`,
        courierName: 'Ecom Express',
        bookingType: 'API_ERROR',
        apiError: error.message,
        errorDetails: error.response?.data,
        responseTime: responseTime,
        timestamp: new Date().toISOString(),
        instructions: 'Please try alternative courier partners or contact support'
      };
    }
  }

  /**
   * Track a shipment
   * @param {string} trackingNumber - AWB number to track
   * @returns {Object} - Tracking information
   */
  async trackShipment(trackingNumber) {
    const startTime = Date.now();

    try {
      logger.info('EcomExpress tracking request:', { trackingNumber });

      const apiClient = this.createApiClient('standard', 'TRACKING');
      const endpoint = this.config.getEndpoint('TRACKING');

      const formData = this.config.createAuthenticatedFormData('standard', {
        awb: trackingNumber
      });

      const response = await apiClient.post(endpoint, formData);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('EcomExpress tracking response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        success: !!response.data?.success
      });

      if (response.data && response.data.success) {
        const trackingData = response.data.data || response.data;

        return {
          success: true,
          trackingNumber: trackingNumber,
          status: trackingData.status || trackingData.current_status,
          statusDetail: trackingData.status_detail || trackingData.current_status_body,
          currentLocation: trackingData.current_location || trackingData.location,
          timestamp: trackingData.timestamp || trackingData.status_date,
          estimatedDelivery: trackingData.expected_delivery_date,
          trackingHistory: trackingData.tracking_history || trackingData.scans || [],
          courierName: 'Ecom Express',
          trackingType: 'API_AUTOMATED',
          responseTime: responseTime,
          lastUpdated: new Date().toISOString()
        };
      } else {
        throw new Error(response.data?.reason || 'EcomExpress tracking failed');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`EcomExpress tracking failed: ${error.message}`, {
        trackingNumber,
        responseTime: `${responseTime}ms`
      });

      return {
        success: true,
        trackingNumber: trackingNumber,
        trackingUrl: this.config.getTrackingUrl(trackingNumber),
        courierName: 'Ecom Express',
        trackingType: 'MANUAL_REQUIRED',
        apiError: error.message,
        instructions: {
          step1: 'Visit https://www.ecomexpress.in/tracking/',
          step2: 'Enter AWB number in the tracking field',
          step3: 'View real-time tracking status',
          step4: 'Contact support if API issues persist'
        },
        message: 'API tracking failed. Manual tracking required.',
        responseTime: responseTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Cancel a shipment
   * @param {string} awbNumber - AWB number to cancel
   * @param {string} serviceType - Service type
   * @returns {Object} - Cancellation response
   */
  async cancelShipment(awbNumber, serviceType = 'standard') {
    const startTime = Date.now();

    try {
      logger.info('EcomExpress shipment cancellation request:', { awbNumber });

      const apiClient = this.createApiClient(serviceType, 'API');
      const endpoint = this.config.getEndpoint('CANCEL_AWB');

      const formData = this.config.createAuthenticatedFormData(serviceType, {
        awbs: [awbNumber]
      });

      const response = await apiClient.post(endpoint, formData);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('EcomExpress cancellation response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        success: !!response.data?.success
      });

      if (response.data && response.data.success) {
        return {
          success: true,
          awb: awbNumber,
          message: 'Shipment cancelled successfully',
          responseTime: responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(response.data?.reason || 'EcomExpress cancellation failed');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`EcomExpress cancellation failed: ${error.message}`, {
        awbNumber,
        responseTime: `${responseTime}ms`
      });

      return {
        success: false,
        awb: awbNumber,
        error: error.message,
        responseTime: responseTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Create shipment (alias for bookShipment for test compatibility)
   * @param {Object} shipmentDetails - Shipment details
   * @returns {Object} - Booking response
   */
  async createShipment(shipmentDetails) {
    return await this.bookShipment(shipmentDetails);
  }

  /**
   * Create Company V2 (NEW - from official docs)
   * @param {Object} companyDetails - Company registration details
   * @returns {Object} - Company creation response
   */
  async createCompanyV2(companyDetails) {
    const startTime = Date.now();

    try {
      logger.info('EcomExpress create company request');

      const apiClient = axios.create({
        baseURL: this.config.ACCOUNT_API.BASE_URL,
        timeout: this.config.REQUEST_TIMEOUT,
        headers: this.config.getAccountHeaders()
      });

      const endpoint = this.config.getEndpoint('CREATE_COMPANY_V2');

      const companyPayload = {
        phone: companyDetails.phone,
        company_name: companyDetails.company_name,
        email: companyDetails.email,
        client_id: companyDetails.client_id,
        branding_user_id: companyDetails.branding_user_id,
        password: companyDetails.password,
        companyLevelTaxRate: companyDetails.companyLevelTaxRate || 5,
        confirm_without_inventory: companyDetails.confirm_without_inventory || 0,
        shipping_address: {
          address_line_1: companyDetails.shipping_address.address_line_1,
          address_line_2: companyDetails.shipping_address.address_line_2 || '',
          state_code: companyDetails.shipping_address.state_code,
          pin_code: companyDetails.shipping_address.pin_code,
          country: companyDetails.shipping_address.country || 'India'
        },
        billing_address: {
          address_line_1: companyDetails.billing_address.address_line_1,
          address_line_2: companyDetails.billing_address.address_line_2 || '',
          state_code: companyDetails.billing_address.state_code,
          pin_code: companyDetails.billing_address.pin_code,
          country: companyDetails.billing_address.country || 'India'
        }
      };

      const response = await apiClient.post(endpoint, companyPayload);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('EcomExpress company creation response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        success: response.data?.code === 200
      });

      if (response.data && response.data.code === 200) {
        return {
          success: true,
          message: response.data.message,
          data: {
            token: response.data.data.token,
            companyId: response.data.data.companyId
          },
          responseTime: responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(response.data?.message || 'Company creation failed');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`EcomExpress company creation failed: ${error.message}`, {
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
   * Create Location (NEW - from official docs)
   * @param {Object} locationDetails - Location details
   * @returns {Object} - Location creation response
   */
  async createLocation(locationDetails) {
    const startTime = Date.now();

    try {
      logger.info('EcomExpress create location request');

      const apiClient = axios.create({
        baseURL: this.config.ACCOUNT_API.BASE_URL,
        timeout: this.config.REQUEST_TIMEOUT,
        headers: this.config.getAccountHeaders()
      });

      const endpoint = this.config.getEndpoint('CREATE_LOCATION');

      const locationPayload = {
        phone: locationDetails.phone,
        company_name: locationDetails.company_name,
        email: locationDetails.email,
        client_id: locationDetails.client_id,
        branding_user_id: locationDetails.branding_user_id,
        password: locationDetails.password,
        companyLevelTaxRate: locationDetails.companyLevelTaxRate || 5,
        confirm_without_inventory: locationDetails.confirm_without_inventory || 0,
        copyMaster: locationDetails.copyMaster || 1,
        manageInventory: locationDetails.manageInventory || 1,
        shipping_address: {
          address_line_1: locationDetails.shipping_address.address_line_1,
          address_line_2: locationDetails.shipping_address.address_line_2 || '',
          state_code: locationDetails.shipping_address.state_code,
          pin_code: locationDetails.shipping_address.pin_code,
          country: locationDetails.shipping_address.country || 'India'
        },
        billing_address: {
          address_line_1: locationDetails.billing_address.address_line_1,
          address_line_2: locationDetails.billing_address.address_line_2 || '',
          state_code: locationDetails.billing_address.state_code,
          pin_code: locationDetails.billing_address.pin_code,
          country: locationDetails.billing_address.country || 'India'
        }
      };

      const response = await apiClient.post(endpoint, locationPayload);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('EcomExpress location creation response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        success: response.data?.code === 200
      });

      if (response.data && response.data.code === 200) {
        return {
          success: true,
          message: response.data.message,
          data: {
            token: response.data.data.token,
            companyId: response.data.data.companyId
          },
          responseTime: responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error(response.data?.message || 'Location creation failed');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`EcomExpress location creation failed: ${error.message}`, {
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
   * Check Company (NEW - from official docs)
   * @param {string} brandingUserId - Branding user ID
   * @param {string} clientId - Client ID
   * @returns {Object} - Company check response
   */
  async checkCompany(brandingUserId, clientId) {
    const startTime = Date.now();

    try {
      logger.info('EcomExpress check company request:', { brandingUserId, clientId });

      const apiClient = axios.create({
        baseURL: this.config.ACCOUNT_API.BASE_URL,
        timeout: this.config.REQUEST_TIMEOUT,
        headers: this.config.getAccountHeaders()
      });

      const endpoint = this.config.getEndpoint('CHECK_COMPANY');
      const queryParams = new URLSearchParams({
        branding_user_id: brandingUserId,
        client_id: clientId
      });

      const response = await apiClient.get(`${endpoint}?${queryParams}`);
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.info('EcomExpress company check response:', {
        status: response.status,
        responseTime: `${responseTime}ms`,
        hasData: !!response.data
      });

      if (response.data) {
        return {
          success: true,
          data: response.data,
          responseTime: responseTime,
          timestamp: new Date().toISOString()
        };
      } else {
        throw new Error('Company check failed');
      }

    } catch (error) {
      const endTime = Date.now();
      const responseTime = endTime - startTime;

      logger.error(`EcomExpress company check failed: ${error.message}`, {
        brandingUserId,
        clientId,
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
   * Clear request cache
   */
  clearCache() {
    this.requestCache.clear();
    logger.info('EcomExpress service cache cleared');
  }

  /**
   * Get service health status
   * @returns {Object} - Health status
   */
  async getHealthStatus() {
    try {
      // Test with a known serviceable pincode
      const testResult = await this.checkPincodeServiceability('400001', 'standard');

      return {
        status: 'HEALTHY',
        apiConnectivity: testResult.success,
        serviceability: testResult.serviceable,
        timestamp: new Date().toISOString(),
        cacheSize: this.requestCache.size
      };
    } catch (error) {
      return {
        status: 'UNHEALTHY',
        error: error.message,
        timestamp: new Date().toISOString(),
        cacheSize: this.requestCache.size
      };
    }
  }
}

// Create and export default instance
const ecomExpressService = new EcomExpressService();
export default ecomExpressService;
