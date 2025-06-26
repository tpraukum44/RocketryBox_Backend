import { DTDC_CONFIG } from '../config/dtdc.config.js';
import { DtdcAPI } from '../utils/dtdc.js';
import { logger } from '../utils/logger.js';

/**
 * DTDC Service Class
 * Professional service layer for DTDC shipping partner integration
 *
 * Features:
 * - Shipment booking and management
 * - Real-time tracking (XML & JSON)
 * - Rate calculation and serviceability
 * - Warehouse registration
 * - Label generation
 * - Pickup scheduling
 */
class DtdcService {
  constructor() {
    this.dtdcAPI = new DtdcAPI();
    this.config = DTDC_CONFIG;
  }

  /**
   * Authenticate with DTDC API
   * @returns {Object} - Authentication result
   */
  async authenticate() {
    try {
      logger.info('DTDC Service: Starting authentication');
      const result = await this.dtdcAPI.authenticate();

      if (result.success) {
        logger.info('DTDC Service: Authentication successful');
      } else {
        logger.error('DTDC Service: Authentication failed:', result.error);
      }

      return result;
    } catch (error) {
      logger.error('DTDC Service: Authentication error:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'DTDC'
      };
    }
  }

  /**
   * Track shipment using preferred API format
   * @param {string} trackingNumber - AWB/Consignment number
   * @param {string} trackType - 'cnno' or 'reference'
   * @param {string} format - 'json' or 'xml'
   * @returns {Object} - Tracking result
   */
  async trackShipment(trackingNumber, trackType = 'cnno', format = 'json') {
    try {
      logger.info(`DTDC Service: Tracking shipment ${trackingNumber} using ${format.toUpperCase()} API`);

      let result;
      if (format.toLowerCase() === 'xml') {
        result = await this.dtdcAPI.trackShipmentXML(trackingNumber, trackType, true);
      } else {
        result = await this.dtdcAPI.trackShipmentJSON(trackingNumber, trackType, true);
      }

      if (result.success) {
        logger.info(`DTDC Service: Tracking successful for ${trackingNumber}`);
      } else {
        logger.warn(`DTDC Service: Tracking failed for ${trackingNumber}:`, result.error);
      }

      return {
        ...result,
        service: 'DTDC',
        apiFormat: format.toUpperCase(),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`DTDC Service: Tracking error for ${trackingNumber}:`, error.message);
      return {
        success: false,
        error: error.message,
        trackingNumber,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check pincode serviceability
   * @param {string} pincode - Pincode to check
   * @returns {Object} - Serviceability result
   */
  async checkServiceability(pincode) {
    try {
      logger.info(`DTDC Service: Checking serviceability for pincode ${pincode}`);

      const result = await this.dtdcAPI.checkServiceability(pincode);

      return {
        ...result,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`DTDC Service: Serviceability check failed for ${pincode}:`, error.message);
      return {
        success: false,
        error: error.message,
        pincode,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Calculate shipping rate
   * @param {Object} packageDetails - Package information
   * @param {Object} deliveryDetails - Delivery information
   * @returns {Object} - Rate calculation result
   */
  async calculateRate(packageDetails, deliveryDetails) {
    try {
      logger.info('DTDC Service: Calculating shipping rate', {
        weight: packageDetails.weight,
        origin: deliveryDetails.pickupPincode,
        destination: deliveryDetails.deliveryPincode
      });

      const result = await this.dtdcAPI.calculateRate(packageDetails, deliveryDetails);

      if (result.success) {
        logger.info('DTDC Service: Rate calculation successful');
      } else {
        logger.warn('DTDC Service: Rate calculation failed:', result.error);
      }

      return {
        ...result,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('DTDC Service: Rate calculation error:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Book a shipment with DTDC
   * @param {Object} shipmentDetails - Shipment booking details
   * @returns {Object} - Booking result
   */
  async bookShipment(shipmentDetails) {
    try {
      logger.info('DTDC Service: Booking shipment', {
        consignee: shipmentDetails.consignee?.name,
        destination: shipmentDetails.consignee?.address?.pincode,
        weight: shipmentDetails.weight
      });

      // Validate required fields
      const validation = this.validateShipmentDetails(shipmentDetails);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          service: 'DTDC'
        };
      }

      // Call DTDC booking API (placeholder for now)
      const result = await this.dtdcAPI.bookShipment(shipmentDetails);

      return {
        ...result,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('DTDC Service: Shipment booking error:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Generate shipping label
   * @param {string} awbNumber - AWB number
   * @param {string} format - Label format (pdf, zpl, etc.)
   * @returns {Object} - Label generation result
   */
  async generateLabel(awbNumber, format = 'pdf') {
    try {
      logger.info(`DTDC Service: Generating ${format.toUpperCase()} label for AWB ${awbNumber}`);

      const result = await this.dtdcAPI.generateShippingLabel(awbNumber, format);

      return {
        ...result,
        service: 'DTDC',
        awbNumber,
        format: format.toUpperCase(),
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error(`DTDC Service: Label generation error for ${awbNumber}:`, error.message);
      return {
        success: false,
        error: error.message,
        awbNumber,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Register warehouse with DTDC
   * @param {Object} warehouseData - Warehouse information
   * @returns {Object} - Registration result
   */
  async registerWarehouse(warehouseData) {
    try {
      logger.info('DTDC Service: Registering warehouse', {
        name: warehouseData.name,
        pincode: warehouseData.pincode,
        city: warehouseData.city
      });

      // Validate warehouse data
      const validation = this.validateWarehouseData(warehouseData);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Validation failed: ${validation.errors.join(', ')}`,
          service: 'DTDC'
        };
      }

      // For now, return a placeholder response
      // This would be implemented when DTDC provides warehouse registration API
      return {
        success: false,
        error: 'DTDC warehouse registration API not yet implemented',
        message: 'Please contact DTDC support for warehouse registration',
        service: 'DTDC',
        warehouseName: warehouseData.name,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('DTDC Service: Warehouse registration error:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Schedule pickup with DTDC
   * @param {Object} pickupDetails - Pickup scheduling details
   * @returns {Object} - Pickup scheduling result
   */
  async schedulePickup(pickupDetails) {
    try {
      logger.info('DTDC Service: Scheduling pickup', {
        location: pickupDetails.address?.pincode,
        date: pickupDetails.pickupDate,
        timeSlot: pickupDetails.timeSlot
      });

      // For now, return a placeholder response
      return {
        success: false,
        error: 'DTDC pickup scheduling API not yet implemented',
        message: 'Please contact DTDC support for pickup scheduling',
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('DTDC Service: Pickup scheduling error:', error.message);
      return {
        success: false,
        error: error.message,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get shipment status
   * @param {string} trackingNumber - Tracking number
   * @returns {Object} - Status result
   */
  async getShipmentStatus(trackingNumber) {
    try {
      logger.info(`DTDC Service: Getting shipment status for ${trackingNumber}`);

      // Use JSON tracking for status
      const trackingResult = await this.trackShipment(trackingNumber, 'cnno', 'json');

      if (trackingResult.success) {
        return {
          success: true,
          trackingNumber,
          status: trackingResult.status,
          statusCode: this.mapStatusToCode(trackingResult.status),
          lastUpdate: trackingResult.deliveryDate,
          location: trackingResult.origin,
          service: 'DTDC',
          timestamp: new Date().toISOString()
        };
      } else {
        return trackingResult;
      }

    } catch (error) {
      logger.error(`DTDC Service: Status check error for ${trackingNumber}:`, error.message);
      return {
        success: false,
        error: error.message,
        trackingNumber,
        service: 'DTDC',
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Validate shipment details before booking
   * @param {Object} shipmentDetails - Shipment details to validate
   * @returns {Object} - Validation result
   */
  validateShipmentDetails(shipmentDetails) {
    const errors = [];

    // Consignee validation
    if (!shipmentDetails.consignee) {
      errors.push('Consignee information is required');
    } else {
      if (!shipmentDetails.consignee.name) errors.push('Consignee name is required');
      if (!shipmentDetails.consignee.phone) errors.push('Consignee phone is required');
      if (!shipmentDetails.consignee.address?.pincode) errors.push('Consignee pincode is required');
    }

    // Shipper validation
    if (!shipmentDetails.shipper) {
      errors.push('Shipper information is required');
    } else {
      if (!shipmentDetails.shipper.name) errors.push('Shipper name is required');
      if (!shipmentDetails.shipper.address?.pincode) errors.push('Shipper pincode is required');
    }

    // Package validation
    if (!shipmentDetails.weight || shipmentDetails.weight <= 0) {
      errors.push('Valid package weight is required');
    }

    if (shipmentDetails.weight > this.config.LIMITS.MAX_WEIGHT) {
      errors.push(`Weight exceeds maximum limit of ${this.config.LIMITS.MAX_WEIGHT}kg`);
    }

    // COD validation
    if (shipmentDetails.paymentType === 'cod') {
      if (!shipmentDetails.codAmount || shipmentDetails.codAmount <= 0) {
        errors.push('COD amount is required for COD shipments');
      }
      if (shipmentDetails.codAmount > this.config.LIMITS.MAX_COD_AMOUNT) {
        errors.push(`COD amount exceeds maximum limit of ₹${this.config.LIMITS.MAX_COD_AMOUNT}`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate warehouse data
   * @param {Object} warehouseData - Warehouse data to validate
   * @returns {Object} - Validation result
   */
  validateWarehouseData(warehouseData) {
    const errors = [];

    if (!warehouseData.name) errors.push('Warehouse name is required');
    if (!warehouseData.address) errors.push('Warehouse address is required');
    if (!warehouseData.city) errors.push('City is required');
    if (!warehouseData.state) errors.push('State is required');
    if (!warehouseData.pincode || !/^\d{6}$/.test(warehouseData.pincode)) {
      errors.push('Valid 6-digit pincode is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Map DTDC status to standard status codes
   * @param {string} dtdcStatus - DTDC status string
   * @returns {string} - Standardized status code
   */
  mapStatusToCode(dtdcStatus) {
    const statusMapping = {
      'DELIVERED': 'DELIVERED',
      'OUT FOR DELIVERY': 'OUT_FOR_DELIVERY',
      'IN TRANSIT': 'IN_TRANSIT',
      'BOOKED': 'BOOKED',
      'PICKED UP': 'PICKED_UP',
      'ATTEMPTED': 'DELIVERY_ATTEMPTED',
      'HELDUP': 'HELD_UP',
      'RTO': 'RETURNED',
      'DELIVERY PROCESS IN PROGRESS': 'IN_TRANSIT'
    };

    return statusMapping[dtdcStatus?.toUpperCase()] || 'UNKNOWN';
  }

  /**
   * Get service health status
   * @returns {Object} - Health check result
   */
  async healthCheck() {
    try {
      logger.info('DTDC Service: Performing health check');

      // Test authentication
      const authResult = await this.authenticate();

      return {
        success: true,
        service: 'DTDC',
        status: 'healthy',
        authentication: authResult.success ? 'working' : 'failed',
        apiEndpoint: this.config.ENDPOINTS.AUTHENTICATE,
        environment: this.config.IS_PRODUCTION ? 'production' : 'staging',
        features: {
          tracking: 'available',
          rateCalculation: 'available',
          serviceability: 'available',
          booking: 'not_implemented',
          labelGeneration: 'not_implemented',
          warehouseRegistration: 'not_implemented'
        },
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('DTDC Service: Health check failed:', error.message);
      return {
        success: false,
        service: 'DTDC',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get service configuration
   * @returns {Object} - Service configuration
   */
  getConfiguration() {
    return {
      service: 'DTDC',
      apiVersion: this.config.API_VERSION,
      environment: this.config.IS_PRODUCTION ? 'production' : 'staging',
      authEndpoint: this.config.ENDPOINTS.AUTHENTICATE,
      trackingEndpoints: {
        xml: this.config.ENDPOINTS.TRACK_XML,
        json: this.config.ENDPOINTS.TRACK_JSON
      },
      serviceTypes: Object.keys(this.config.SERVICE_TYPES),
      limits: this.config.LIMITS,
      features: {
        authentication: true,
        tracking: true,
        rateCalculation: true,
        serviceability: true,
        booking: false,  // Not yet implemented
        labelGeneration: false,  // Not yet implemented
        warehouseRegistration: false  // Not yet implemented
      }
    };
  }
}

// Create and export singleton instance
const dtdcService = new DtdcService();

export default dtdcService;
export { DtdcService };
