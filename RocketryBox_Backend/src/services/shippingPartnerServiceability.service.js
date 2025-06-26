import { logger } from '../utils/logger.js';

// Import shipping partner utilities for serviceability checks
import * as bluedartUtils from '../utils/bluedart.js';
import * as delhiveryUtils from '../utils/delhivery.js';
import * as dtdcUtils from '../utils/dtdc.js';
import * as ecomexpressUtils from '../utils/ecomexpress.js';
import * as ekartUtils from '../utils/ekart.js';
import * as xpressbeesUtils from '../utils/xpressbees.js';

/**
 * Shipping Partner Serviceability Service
 * Checks if shipping partners are serviceable for given pickup and delivery pincodes
 */
class ShippingPartnerServiceabilityService {
  constructor() {
    // Map of courier names to their utility functions
    this.courierServiceabilityMap = {
      'Delhivery': {
        checkServiceability: delhiveryUtils.checkServiceability,
        requiresBothPincodes: false, // Only needs delivery pincode
        name: 'Delhivery'
      },
      'DELHIVERY': {
        checkServiceability: delhiveryUtils.checkServiceability,
        requiresBothPincodes: false,
        name: 'Delhivery'
      },
      'Delivery Service': {
        checkServiceability: delhiveryUtils.checkServiceability,
        requiresBothPincodes: false,
        name: 'Delhivery'
      },

      'DTDC': {
        checkServiceability: dtdcUtils.checkServiceability,
        requiresBothPincodes: false, // Only needs delivery pincode
        name: 'DTDC'
      },
      'Dtdc': {
        checkServiceability: dtdcUtils.checkServiceability,
        requiresBothPincodes: false,
        name: 'DTDC'
      },
      'DTDC Express': {
        checkServiceability: dtdcUtils.checkServiceability,
        requiresBothPincodes: false,
        name: 'DTDC'
      },

      'Ekart': {
        checkServiceability: ekartUtils.checkServiceabilityV2,
        requiresBothPincodes: false, // Only needs delivery pincode
        name: 'Ekart'
      },
      'EKART': {
        checkServiceability: ekartUtils.checkServiceabilityV2,
        requiresBothPincodes: false,
        name: 'Ekart'
      },
      'eKart': {
        checkServiceability: ekartUtils.checkServiceabilityV2,
        requiresBothPincodes: false,
        name: 'Ekart'
      },
      'Ekart Logistics': {
        checkServiceability: ekartUtils.checkServiceabilityV2,
        requiresBothPincodes: false,
        name: 'Ekart'
      },

      'Ecom Express': {
        checkServiceability: ecomexpressUtils.checkPincodeServiceability,
        requiresBothPincodes: false, // Only needs delivery pincode (pass 'standard' as service type)
        name: 'Ecom Express'
      },
      'ECOMEXPRESS': {
        checkServiceability: ecomexpressUtils.checkPincodeServiceability,
        requiresBothPincodes: false,
        name: 'Ecom Express'
      },
      'EcomExpress': {
        checkServiceability: ecomexpressUtils.checkPincodeServiceability,
        requiresBothPincodes: false,
        name: 'Ecom Express'
      },

      'XpressBees': {
        checkServiceability: xpressbeesUtils.checkPincodeServiceability,
        requiresBothPincodes: true, // Needs both pickup and delivery pincodes
        name: 'XpressBees'
      },
      'XPRESSBEES': {
        checkServiceability: xpressbeesUtils.checkPincodeServiceability,
        requiresBothPincodes: true,
        name: 'XpressBees'
      },
      'Xpressbees': {
        checkServiceability: xpressbeesUtils.checkPincodeServiceability,
        requiresBothPincodes: true,
        name: 'XpressBees'
      },

      'BlueDart': {
        checkServiceability: this.checkBlueDartServiceability.bind(this),
        requiresBothPincodes: false, // Only needs delivery pincode
        name: 'BlueDart'
      },
      'BLUEDART': {
        checkServiceability: this.checkBlueDartServiceability.bind(this),
        requiresBothPincodes: false,
        name: 'BlueDart'
      },
      'BlueDart+': {
        checkServiceability: this.checkBlueDartServiceability.bind(this),
        requiresBothPincodes: false,
        name: 'BlueDart'
      },
      'Blue Dart': {
        checkServiceability: this.checkBlueDartServiceability.bind(this),
        requiresBothPincodes: false,
        name: 'BlueDart'
      },


    };

    // Timeout for serviceability checks (in milliseconds)
    this.serviceabilityTimeout = 8000; // 8 seconds (reduced from 10)
  }



  /**
   * BlueDart serviceability check wrapper
   * Uses the getServicesForPincodeAndProduct API
   */
  async checkBlueDartServiceability(pincode) {
    try {
      // Use BlueDart's service check API with default parameters
      const result = await bluedartUtils.getServicesForPincodeAndProduct(
        pincode,
        'A', // Express product code
        'P', // Standard sub-product
        'L', // Standard pack type
        'R', // Standard feature
        null // No specific partner details needed
      );

      return {
        success: true,
        pincode: pincode,
        serviceable: result.success && result.data,
        services: result.data || {},
        message: result.success ? 'BlueDart services available' : 'No BlueDart services available',
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`BlueDart serviceability check failed for ${pincode}:`, error.message);
      return {
        success: false,
        pincode: pincode,
        serviceable: false,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check serviceability for a single courier
   * @param {string} courierName - Name of the courier
   * @param {string} pickupPincode - Pickup pincode
   * @param {string} deliveryPincode - Delivery pincode
   * @param {string} serviceType - Service type (standard, express, cod)
   * @returns {Object} - Serviceability result
   */
  async checkCourierServiceability(courierName, pickupPincode, deliveryPincode, serviceType = 'standard') {
    const startTime = Date.now();

    try {
      // Normalize courier name and get serviceability config
      const normalizedCourierName = courierName.trim();
      const courierConfig = this.courierServiceabilityMap[normalizedCourierName];

      if (!courierConfig) {
        logger.warn(`No serviceability check configured for courier: ${normalizedCourierName}`);
        // **CHANGED**: Return NOT serviceable by default for unknown couriers
        return {
          courier: normalizedCourierName,
          serviceable: false,
          reason: 'No serviceability check configured for this courier',
          checkTime: Date.now() - startTime,
          timestamp: new Date().toISOString()
        };
      }

      logger.info(`Checking serviceability for ${courierConfig.name}: ${pickupPincode} → ${deliveryPincode}`);

      // Create a promise that will timeout
      const serviceabilityPromise = new Promise(async (resolve) => {
        try {
          let result;

          if (courierConfig.requiresBothPincodes) {
            // Couriers that need both pickup and delivery pincodes (e.g., XpressBees)
            result = await courierConfig.checkServiceability(pickupPincode, deliveryPincode);
          } else {
            // Couriers that only need delivery pincode
            if (courierConfig.name === 'Ecom Express') {
              // Ecom Express needs serviceType as second parameter
              result = await courierConfig.checkServiceability(deliveryPincode, serviceType);
            } else {
              // Delhivery, Ekart, BlueDart
              result = await courierConfig.checkServiceability(deliveryPincode);
            }
          }

          // **ENHANCED**: More strict response analysis
          let serviceable = false;
          let reason = 'Unknown serviceability status';

          // First check if the API call itself was successful
          if (!result || (result.hasOwnProperty('success') && result.success === false)) {
            serviceable = false;
            reason = result?.error || result?.message || 'API call failed';
          } else {
            // API call succeeded, now check the actual serviceability
            if (courierConfig.requiresBothPincodes) {
              // XpressBees format
              serviceable = !!(result.overallServiceable === true ||
                (result.destination && result.destination.serviceable === true));
              reason = serviceable ? 'Service available for both locations' :
                'Service not available for one or both locations';
            } else if (result.hasOwnProperty('serviceable')) {
              // Standard format (Delhivery, Ekart, BlueDart) - be strict about the value
              serviceable = result.serviceable === true;
              reason = serviceable ? 'Service available' :
                (result.message || result.reason || result.error || 'Service not available');
            } else if (courierConfig.name === 'Ecom Express') {
              // Ecom Express format - check both success and serviceable
              serviceable = !!(result.serviceable === true ||
                (result.success === true && result.serviceable !== false));
              reason = serviceable ? 'Service available' : 'Service not available';
            } else if (courierConfig.name === 'BlueDart') {
              // BlueDart format - check if services array has items
              serviceable = result.serviceable === true;
              reason = serviceable ? (result.message || 'BlueDart services available') : (result.message || 'No BlueDart services available');
            } else {
              // **CHANGED**: Don't assume serviceable - be conservative
              serviceable = false;
              reason = 'Unable to determine serviceability from API response';
            }
          }

          resolve({
            courier: courierConfig.name,
            serviceable: serviceable,
            reason: reason,
            checkTime: Date.now() - startTime,
            rawResult: result,
            timestamp: new Date().toISOString()
          });

        } catch (error) {
          logger.error(`Serviceability check failed for ${courierConfig.name}:`, error.message);
          resolve({
            courier: courierConfig.name,
            serviceable: false, // **CHANGED**: Always false on error
            reason: `API error: ${error.message}`,
            checkTime: Date.now() - startTime,
            error: error.message,
            timestamp: new Date().toISOString()
          });
        }
      });

      // Add timeout to the serviceability check
      const timeoutPromise = new Promise((resolve) => {
        setTimeout(() => {
          resolve({
            courier: courierConfig.name,
            serviceable: false, // **CHANGED**: Default to NOT serviceable on timeout
            reason: 'Serviceability check timed out - assuming not serviceable',
            checkTime: this.serviceabilityTimeout,
            timeout: true,
            timestamp: new Date().toISOString()
          });
        }, this.serviceabilityTimeout);
      });

      // Race between serviceability check and timeout
      const result = await Promise.race([serviceabilityPromise, timeoutPromise]);

      logger.info(`Serviceability check completed for ${result.courier}: ${result.serviceable ? 'SERVICEABLE' : 'NOT SERVICEABLE'} (${result.checkTime}ms) - ${result.reason}`);

      return result;

    } catch (error) {
      logger.error(`Serviceability check error for ${courierName}:`, error.message);
      return {
        courier: courierName,
        serviceable: false, // **CHANGED**: Always false on error
        reason: `Serviceability check failed: ${error.message}`,
        checkTime: Date.now() - startTime,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Check serviceability for multiple couriers in parallel
   * @param {Array} courierNames - Array of courier names
   * @param {string} pickupPincode - Pickup pincode
   * @param {string} deliveryPincode - Delivery pincode
   * @param {string} serviceType - Service type (standard, express, cod)
   * @returns {Object} - Serviceability results for all couriers
   */
  async checkMultipleCouriersServiceability(courierNames, pickupPincode, deliveryPincode, serviceType = 'standard') {
    const startTime = Date.now();

    try {
      logger.info(`Checking serviceability for ${courierNames.length} couriers: ${pickupPincode} → ${deliveryPincode}`);

      // Run all serviceability checks in parallel
      const serviceabilityPromises = courierNames.map(courierName =>
        this.checkCourierServiceability(courierName, pickupPincode, deliveryPincode, serviceType)
      );

      const results = await Promise.all(serviceabilityPromises);

      // Separate serviceable and non-serviceable couriers
      const serviceableCouriers = results.filter(result => result.serviceable === true);
      const nonServiceableCouriers = results.filter(result => result.serviceable !== true);

      const totalTime = Date.now() - startTime;

      logger.info(`Serviceability check completed for all couriers (${totalTime}ms): ${serviceableCouriers.length} serviceable, ${nonServiceableCouriers.length} not serviceable`);

      // Log details for debugging
      if (serviceableCouriers.length > 0) {
        logger.info('✅ Serviceable couriers:', serviceableCouriers.map(c => `${c.courier} (${c.reason})`));
      }
      if (nonServiceableCouriers.length > 0) {
        logger.info('❌ Non-serviceable couriers:', nonServiceableCouriers.map(c => `${c.courier} (${c.reason})`));
      }

      return {
        success: true,
        pickupPincode,
        deliveryPincode,
        serviceType,
        totalCouriers: courierNames.length,
        serviceableCouriers: serviceableCouriers,
        nonServiceableCouriers: nonServiceableCouriers,
        serviceableCount: serviceableCouriers.length,
        nonServiceableCount: nonServiceableCouriers.length,
        checkTime: totalTime,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Multiple courier serviceability check failed:', error.message);
      return {
        success: false,
        error: error.message,
        pickupPincode,
        deliveryPincode,
        serviceType,
        totalCouriers: courierNames.length,
        checkTime: Date.now() - startTime,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Filter rate calculations based on serviceability
   * @param {Array} rateCalculations - Array of rate calculation results
   * @param {Array} serviceabilityResults - Array of serviceability check results
   * @returns {Array} - Filtered rate calculations with only serviceable couriers
   */
  filterRatesByServiceability(rateCalculations, serviceabilityResults) {
    const serviceableCouriers = new Set(
      serviceabilityResults
        .filter(result => result.serviceable === true) // **CHANGED**: Strict equality check
        .map(result => result.courier)
    );

    logger.info('🔍 Serviceable couriers for filtering:', Array.from(serviceableCouriers));

    const filteredRates = rateCalculations.filter(rate => {
      // Check if the courier is serviceable (try multiple name variations)
      const isServiceable = serviceableCouriers.has(rate.courier) ||
        serviceableCouriers.has(rate.courier.replace(/\s+/g, '')) || // Remove spaces
        serviceableCouriers.has(rate.courier.toUpperCase()) ||
        serviceableCouriers.has(rate.courier.toLowerCase()) ||
        // Check common name variations
        (rate.courier.includes('Delivery') && serviceableCouriers.has('Delhivery')) ||
        (rate.courier.includes('eKart') && serviceableCouriers.has('Ekart')) ||
        (rate.courier.includes('Ecom') && serviceableCouriers.has('Ecom Express'));

      if (!isServiceable) {
        logger.info(`🚫 Filtering out rate for non-serviceable courier: ${rate.courier}`);
      } else {
        logger.info(`✅ Including rate for serviceable courier: ${rate.courier}`);
      }

      return isServiceable;
    });

    logger.info(`📊 Rate filtering completed: ${filteredRates.length}/${rateCalculations.length} rates from serviceable couriers`);

    return filteredRates;
  }

  /**
   * Get list of available couriers for serviceability checking
   * @returns {Array} - Array of supported courier names
   */
  getSupportedCouriers() {
    return Object.keys(this.courierServiceabilityMap)
      .filter(courier => !courier.includes(' ') && courier === courier.charAt(0).toUpperCase() + courier.slice(1))
      .map(courier => this.courierServiceabilityMap[courier].name)
      .filter((name, index, arr) => arr.indexOf(name) === index); // Remove duplicates
  }

  /**
   * Health check for serviceability service
   * @returns {Object} - Health check result
   */
  async healthCheck() {
    try {
      const supportedCouriers = this.getSupportedCouriers();

      return {
        success: true,
        status: 'healthy',
        supportedCouriers: supportedCouriers,
        courierCount: supportedCouriers.length,
        serviceabilityTimeout: this.serviceabilityTimeout,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
export const shippingPartnerServiceabilityService = new ShippingPartnerServiceabilityService();
export default shippingPartnerServiceabilityService;
