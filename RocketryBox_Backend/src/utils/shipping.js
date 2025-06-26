import ShippingPartner from '../modules/admin/models/shippingPartner.model.js';
import * as bluedart from './bluedart.js';
import { calculateRate } from './courierRates.js';
import * as delhivery from './delhivery.js';
import * as dtdc from './dtdc.js';
import * as ecomexpress from './ecomexpress.js';
import * as ekart from './ekart.js';
import { getCache, setCache } from './redis.js';
import * as xpressbees from './xpressbees.js';

// RATE CALCULATION CONFIGURATION - Hardcoded values
const RATE_CALCULATION_CONFIG = {
  // Default method for all partners - using database rate cards
  DEFAULT_METHOD: 'DATABASE',

  // Partner-specific overrides - all set to use database rate cards
  PARTNER_OVERRIDES: {
    'Delhivery': 'DATABASE',     // Using database rate cards for cost control
    'BlueDart': 'DATABASE',      // Using database rate cards
    'DTDC': 'DATABASE',          // Using database rate cards
    'Ecom Express': 'DATABASE',  // Using database rate cards
    'Ekart': 'DATABASE',         // Using database rate cards
    'Xpressbees': 'DATABASE'     // Using database rate cards
  },

  // API Type preferences when using API method
  API_TYPE_PREFERENCE: {
    'Delhivery': 'B2C',         // B2C API preference
    'BlueDart': 'B2C',          // B2C API preference
    'DTDC': 'B2C',              // B2C API preference
    'Ecom Express': 'B2C',      // B2C API preference
    'Ekart': 'B2C',             // B2C API preference
    'Xpressbees': 'B2C'         // B2C API preference
  }
};

// Map of courier code to their respective utility modules
const courierModules = {
  BLUEDART: bluedart,
  BlueDart: bluedart,
  DTDC: dtdc,
  Dtdc: dtdc,
  'DTDC Express': dtdc,
  ECOMEXPRESS: ecomexpress,
  EcomExpress: ecomexpress,
  'Ecom Express': ecomexpress,
  DELHIVERY: delhivery,
  Delhivery: delhivery,

  EKART: ekart,
  Ekart: ekart,
  'Ekart Logistics': ekart,
  XPRESSBEES: xpressbees,
  XpressBees: xpressbees
};

// Shipping rate configuration
const RATE_CONFIG = {
  baseRate: 50, // Base rate in INR
  weightMultiplier: 20, // Rate per kg
  distanceMultiplier: 0.5, // Rate per km
  serviceMultiplier: {
    standard: 1,
    express: 1.5,
    cod: 1.2
  }
};

// Calculate distance between two pincodes (simplified)
const calculateDistance = (pickupPincode, deliveryPincode) => {
  // In a real application, this would use a proper distance calculation
  // or a third-party service to get accurate distances
  const pincode1 = parseInt(pickupPincode);
  const pincode2 = parseInt(deliveryPincode);
  return Math.abs(pincode1 - pincode2) / 100; // Simplified distance in km
};

// Calculate volumetric weight
const calculateVolumetricWeight = (dimensions) => {
  const { length, width, height } = dimensions;
  return (length * width * height) / 5000; // Standard volumetric weight calculation
};

/**
 * Determine which rate calculation method to use for a partner
 * @param {string} partnerName - The partner name
 * @returns {string} - 'API' or 'DATABASE'
 */
const getRateCalculationMethod = (partnerName) => {
  // Check for partner-specific override first
  if (RATE_CALCULATION_CONFIG.PARTNER_OVERRIDES[partnerName]) {
    return RATE_CALCULATION_CONFIG.PARTNER_OVERRIDES[partnerName];
  }

  // Fall back to default method
  return RATE_CALCULATION_CONFIG.DEFAULT_METHOD;
};

/**
 * Get shipping partner details from database and cache them
 * @param {string} courierCode - The courier code (e.g., 'BLUEDART', 'DELHIVERY')
 * @returns {Object} - The shipping partner details
 */
export const getPartnerDetails = async (courierCode) => {
  try {
    console.log(`🔍 getPartnerDetails called with courierCode: "${courierCode}"`);

    // Apply courier name mapping for legacy issues
    const courierNameMapping = {
      'Delivery Service': 'Delhivery',  // Fix for legacy naming
      'DELIVERY SERVICE': 'Delhivery',
      'delivery service': 'Delhivery'
    };

    const mappedCourierCode = courierNameMapping[courierCode] || courierCode;

    if (mappedCourierCode !== courierCode) {
      console.log(`🔄 Mapped courier name: "${courierCode}" → "${mappedCourierCode}"`);
    }

    // Check for cached partner details (use mapped name for cache key)
    const cacheKey = `partner:${mappedCourierCode}`;
    console.log(`🔍 Checking Redis cache for key: ${cacheKey}`);

    const cachedPartner = await getCache(cacheKey);
    if (cachedPartner) {
      console.log(`✅ Found cached partner for ${mappedCourierCode}:`, {
        id: cachedPartner.id,
        name: cachedPartner.name
      });
      return cachedPartner;
    }

    console.log(`❌ No cached partner found, querying database...`);

    // Check database connection
    const mongoose = await import('mongoose');
    const connectionState = mongoose.default.connection.readyState;
    const connectionStates = {
      0: 'disconnected',
      1: 'connected',
      2: 'connecting',
      3: 'disconnecting'
    };

    console.log(`🔍 MongoDB connection state: ${connectionStates[connectionState]} (${connectionState})`);
    console.log(`🔍 Database name: ${mongoose.default.connection.db?.databaseName || 'undefined'}`);

    if (connectionState !== 1) {
      console.log(`❌ MongoDB not connected! Connection state: ${connectionStates[connectionState]}`);
      return null;
    }

    // Find partner by name, case-insensitive (use mapped courier code)
    const query = {
      name: { $regex: new RegExp(`^${mappedCourierCode}$`, 'i') },
      apiStatus: 'active' // Only use active partners
    };

    console.log(`🔍 Database query:`, JSON.stringify(query, null, 2));

    let partner = await ShippingPartner.findOne(query).lean();

    console.log(`🔍 Database query result:`, {
      found: !!partner,
      partner: partner ? {
        id: partner._id,
        name: partner.name,
        apiStatus: partner.apiStatus
      } : null
    });

    // If partner not found, create default partner for testing
    if (!partner) {
      console.log(`❌ No partner found in database for "${mappedCourierCode}"`);

      // Let's check if partner exists without apiStatus filter
      const partnerAnyStatus = await ShippingPartner.findOne({
        name: { $regex: new RegExp(`^${mappedCourierCode}$`, 'i') }
      }).lean();

      if (partnerAnyStatus) {
        console.log(`⚠️  Partner exists but with apiStatus: "${partnerAnyStatus.apiStatus}" (expected: "active")`);
      } else {
        console.log(`❌ Partner does not exist at all in database`);

        // Let's check what partners actually exist
        const allPartners = await ShippingPartner.find({}).select('name apiStatus').lean();
        console.log(`📋 All partners in database:`, allPartners.map(p => ({ name: p.name, status: p.apiStatus })));
      }

      return null;
    }

    console.log(`✅ Found partner in database: ${partner.name}`);

    // Extract relevant details for API integration
    const partnerDetails = {
      id: partner._id.toString(),
      name: partner.name,
      apiKey: partner.apiKey,
      apiEndpoint: partner.apiEndpoint,
      serviceTypes: partner.serviceTypes,
      weightLimits: partner.weightLimits,
      dimensionLimits: partner.dimensionLimits,
      rates: partner.rates,
      zones: partner.zones,
      trackingUrl: partner.trackingUrl
    };

    console.log(`💾 Caching partner details for ${mappedCourierCode}`);

    // Cache the partner details (use mapped name)
    await setCache(cacheKey, partnerDetails, 1800); // 30 minutes cache

    console.log(`✅ Returning partner details for ${mappedCourierCode}`);
    return partnerDetails;
  } catch (error) {
    console.log(`💥 Error in getPartnerDetails for ${courierCode}:`, {
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3)
    });
    return null;
  }
};

/**
 * Get shipping rates for multiple partners
 * @param {Object} packageDetails - Package weight, dimensions, value
 * @param {Object} deliveryDetails - Pickup and delivery addresses
 * @param {Array} availablePartners - List of partner names to get rates from
 * @returns {Array} - Array of rate objects with partner details
 */
export const calculateShippingRates = async (packageDetails, deliveryDetails, availablePartners = []) => {
  try {
    // If no partners specified, use default list
    if (availablePartners.length === 0) {
      availablePartners = ['Delhivery', 'BlueDart', 'DTDC', 'Ecom Express', 'Ekart', 'Xpressbees'];
    }

    // Apply courier name mapping for consistency
    const courierNameMapping = {
      'Delivery Service': 'Delhivery',  // Fix for legacy naming
      'DELIVERY SERVICE': 'Delhivery',
      'delivery service': 'Delhivery'
    };

    // Get rate calculation method for each partner
    const ratePromises = availablePartners.map(async (partnerName) => {
      try {
        // Apply name mapping
        const mappedPartnerName = courierNameMapping[partnerName] || partnerName;

        // Get partner details from database
        const partnerDetails = await getPartnerDetails(partnerName);

        if (!partnerDetails) {
          // Create fallback partner details for rate calculation
          const fallbackPartner = {
            id: `fallback_${partnerName.toLowerCase()}`,
            name: partnerName,
            rates: { baseRate: 50, weightRate: 20, dimensionalFactor: 5000 }
          };
        }

        // Determine rate calculation method for this partner (use mapped name)
        const rateMethod = RATE_CALCULATION_CONFIG.PARTNER_OVERRIDES[mappedPartnerName] || RATE_CALCULATION_CONFIG.DEFAULT_METHOD;
        const apiType = RATE_CALCULATION_CONFIG.API_TYPE_PREFERENCE[mappedPartnerName] || 'B2C';

        if (rateMethod === 'API' || rateMethod === 'B2C_API' || rateMethod === 'B2B_API') {
          // Check if partner module exists for API integration
          let partnerModule = courierModules[mappedPartnerName] || courierModules[mappedPartnerName.toUpperCase()];

          if (partnerModule && partnerModule.calculateRate) {

            // For Delhivery, check if we should use B2B API
            if (mappedPartnerName === 'Delhivery' && (rateMethod === 'B2B_API' || apiType === 'B2B')) {
              // Use B2B freight estimator instead of B2C rate calculation
              try {
                const delhiveryAPI = new (await import('./delhivery.js')).DelhiveryAPI();
                const freightResult = await delhiveryAPI.b2bFreightEstimator({
                  dimensions: [{
                    length_cm: packageDetails.dimensions?.length || 20,
                    width_cm: packageDetails.dimensions?.width || 15,
                    height_cm: packageDetails.dimensions?.height || 10,
                    box_count: 1
                  }],
                  weightG: Math.round(packageDetails.weight * 1000), // Convert to grams
                  sourcePin: deliveryDetails.pickupPincode,
                  consigneePin: deliveryDetails.deliveryPincode,
                  paymentMode: packageDetails.paymentMode?.toLowerCase() === 'cod' ? 'cod' : 'prepaid',
                  codAmount: packageDetails.codAmount || 0,
                  invAmount: packageDetails.invoiceValue || packageDetails.codAmount || 1000,
                  freightMode: 'fop',
                  rovInsurance: false
                });

                if (freightResult.success) {
                  return {
                    partner: mappedPartnerName,
                    serviceType: 'B2B',
                    rate: freightResult.estimate.totalPrice,
                    currency: 'INR',
                    estimatedDelivery: freightResult.estimate.transitDays || '3-5 days',
                    breakdown: freightResult.estimate,
                    method: 'B2B_API',
                    timestamp: new Date().toISOString()
                  };
                }
              } catch (error) {
                // If B2B fails, fall back to database rates
              }
            }

            // Use standard B2C API rate calculation
            const rateResult = await partnerModule.calculateRate(packageDetails, deliveryDetails, partnerDetails);

            if (rateResult && rateResult.success) {
              return {
                partner: mappedPartnerName,
                serviceType: rateResult.serviceType || 'standard',
                rate: rateResult.rate?.totalRate || rateResult.total,
                currency: 'INR',
                estimatedDelivery: rateResult.estimatedDelivery || '3-5 days',
                breakdown: rateResult.rate || rateResult.breakdown,
                method: rateMethod,
                timestamp: new Date().toISOString()
              };
            }
          }
        }

        // Fallback to database rate calculation
        const rateResult = await calculateRate(packageDetails, deliveryDetails, partnerDetails);

        return {
          partner: mappedPartnerName,
          serviceType: rateResult.serviceType || 'standard',
          rate: rateResult.total,
          currency: 'INR',
          estimatedDelivery: rateResult.estimatedDelivery || '3-5 days',
          breakdown: rateResult.breakdown,
          method: 'DATABASE',
          timestamp: new Date().toISOString()
        };

      } catch (error) {
        return {
          partner: mappedPartnerName,
          error: error.message,
          method: 'ERROR',
          timestamp: new Date().toISOString()
        };
      }
    });

    const allRates = await Promise.all(ratePromises);

    // Filter out failed rate calculations
    const validRates = allRates.filter(rate => rate && !rate.error);

    return validRates;

  } catch (error) {
    throw new Error(`Error calculating shipping rates: ${error.message}`);
  }
};

/**
 * Book a shipment with the specified courier - RETURNS RAW RESPONSES
 * @param {string} courierCode - The courier code
 * @param {Object} shipmentDetails - Shipment booking details
 * @returns {Object} - Raw booking response from courier API
 */
export const bookShipment = async (courierCode, shipmentDetails) => {
  try {
    console.log(`🔍 Looking up partner details for: ${courierCode}`);

    const partnerDetails = await getPartnerDetails(courierCode);

    if (!partnerDetails) {
      console.log(`❌ Partner details not found in database for: ${courierCode}`);
      console.log(`🔍 Database query should look for courier with name matching: ${courierCode}`);

      return {
        success: false,
        error: `Partner details not found for ${courierCode}. Please check if this partner exists in the database.`,
        rawResponse: null,
        courierName: courierCode,
        troubleshooting: {
          courierCode: courierCode,
          suggestion: `Check if shipping partner '${courierCode}' exists in the database`,
          databaseQuery: `ShippingPartner.findOne({ name: { $regex: /^${courierCode}$/i }, apiStatus: 'active' })`
        }
      };
    }

    console.log(`✅ Found partner details for ${courierCode}:`, {
      id: partnerDetails.id,
      name: partnerDetails.name,
      apiStatus: 'active'
    });

    // Check if partner module exists
    const partnerModule = courierModules[courierCode.toUpperCase()];

    if (!partnerModule || !partnerModule.bookShipment) {
      return {
        success: false,
        error: `Booking functionality not available for ${courierCode}`,
        rawResponse: null,
        courierName: courierCode
      };
    }

    console.log(`📞 Calling ${courierCode} booking API`);

    // Call the partner-specific booking function and return RAW response
    const bookingResponse = await partnerModule.bookShipment(shipmentDetails, partnerDetails);

    // 🔥 RAW API RESPONSE LOGGING - EXACTLY WHAT USER WANTS TO SEE
    console.log(`\n=====================================================`);
    console.log(`🔥 RAW ${courierCode} API RESPONSE:`);
    console.log(`Status Code: ${bookingResponse.statusCode || bookingResponse.status || 'N/A'}`);
    console.log(`Response Body:`, bookingResponse.rawResponse || bookingResponse);
    console.log(`Full Response:`, JSON.stringify(bookingResponse, null, 2));
    console.log(`=====================================================\n`);

    // Return the raw response without modification
    return {
      ...bookingResponse,
      rawApiResponse: bookingResponse, // Include complete raw response
      courierCode,
      timestamp: new Date().toISOString()
    };

  } catch (error) {
    console.log(`💥 bookShipment error for ${courierCode}:`, error.message);

    return {
      success: false,
      error: error.message,
      rawError: error,
      courierName: courierCode,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Book a shipment for SELLER section using B2B APIs - RETURNS RAW RESPONSES
 * @param {string} courierCode - The courier code
 * @param {Object} shipmentDetails - Shipment booking details
 * @returns {Object} - Raw booking response from courier B2B API
 */
export const bookShipmentForSeller = async (courierCode, shipmentDetails) => {
  try {
    console.log(`🏢 B2B: Looking up partner details for seller shipment: ${courierCode}`);

    const partnerDetails = await getPartnerDetails(courierCode);

    if (!partnerDetails) {
      console.log(`❌ B2B: Partner details not found in database for: ${courierCode}`);

      return {
        success: false,
        error: `Partner details not found for ${courierCode}. Please check if this partner exists in the database.`,
        rawResponse: null,
        courierName: courierCode,
        businessType: 'B2B',
        troubleshooting: {
          courierCode: courierCode,
          suggestion: `Check if shipping partner '${courierCode}' exists in the database`,
          databaseQuery: `ShippingPartner.findOne({ name: { $regex: /^${courierCode}$/i }, apiStatus: 'active' })`
        }
      };
    }

    console.log(`✅ B2B: Found partner details for ${courierCode}:`, {
      id: partnerDetails.id,
      name: partnerDetails.name,
      apiStatus: 'active',
      businessType: 'B2B'
    });

    // Check if partner module exists
    const partnerModule = courierModules[courierCode.toUpperCase()];

    if (!partnerModule) {
      return {
        success: false,
        error: `Partner module not available for ${courierCode}`,
        rawResponse: null,
        courierName: courierCode,
        businessType: 'B2B'
      };
    }

    // For Delhivery, use dedicated B2B method
    if (courierCode.toUpperCase() === 'DELHIVERY') {
      if (!partnerModule.bookShipmentForSeller) {
        return {
          success: false,
          error: `B2B booking functionality not available for ${courierCode}`,
          rawResponse: null,
          courierName: courierCode,
          businessType: 'B2B'
        };
      }

      console.log(`📞 B2B: Calling ${courierCode} B2B booking API`);

      // Call the B2B-specific booking function
      const bookingResponse = await partnerModule.bookShipmentForSeller(shipmentDetails, partnerDetails);

      return {
        ...bookingResponse,
        rawApiResponse: bookingResponse,
        courierCode,
        businessType: 'B2B',
        timestamp: new Date().toISOString()
      };
    }

    // For other couriers that don't have separate B2B methods, use regular booking
    // but mark it as B2B usage
    else {
      if (!partnerModule.bookShipment) {
        return {
          success: false,
          error: `Booking functionality not available for ${courierCode}`,
          rawResponse: null,
          courierName: courierCode,
          businessType: 'B2B'
        };
      }

      console.log(`📞 B2B: Calling ${courierCode} standard API for B2B usage`);

      // Call the standard booking function but mark as B2B
      const bookingResponse = await partnerModule.bookShipment(shipmentDetails, partnerDetails);

      return {
        ...bookingResponse,
        rawApiResponse: bookingResponse,
        courierCode,
        businessType: 'B2B',
        timestamp: new Date().toISOString()
      };
    }

  } catch (error) {
    console.log(`💥 B2B bookShipmentForSeller error for ${courierCode}:`, error.message);

    return {
      success: false,
      error: error.message,
      rawError: error,
      courierName: courierCode,
      businessType: 'B2B',
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Track a shipment with specified courier
 * @param {string} trackingNumber - The tracking/AWB number
 * @param {string} courierCode - The courier code
 * @returns {Object} - Tracking response
 */
export const trackShipment = async (trackingNumber, courierCode) => {
  try {
    const partnerDetails = await getPartnerDetails(courierCode);

    if (!partnerDetails) {
      return {
        success: false,
        error: `Partner details not found for ${courierCode}`
      };
    }

    // Check if partner module exists
    const partnerModule = courierModules[courierCode.toUpperCase()];

    if (!partnerModule || !partnerModule.trackShipment) {
      return {
        success: false,
        error: `Tracking functionality not available for ${courierCode}`
      };
    }

    // Call the partner-specific tracking function
    const trackingResponse = await partnerModule.trackShipment(trackingNumber, partnerDetails);

    return trackingResponse;
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Get next available waybill from a shipping partner
 * @param {string} courierCode - The courier code (e.g., 'DELHIVERY', 'BLUEDART')
 * @returns {string} - The next available waybill number
 */
export const getNextWaybill = async (courierCode) => {
  try {
    const partnerDetails = await getPartnerDetails(courierCode);

    if (!partnerDetails) {
      throw new Error(`Partner details not found for ${courierCode}`);
    }

    // Check if partner module exists and has waybill functionality
    const partnerModule = courierModules[courierCode.toUpperCase()];

    if (!partnerModule || !partnerModule.getNextWaybill) {
      throw new Error(`Waybill functionality not available for ${courierCode}`);
    }

    // Call the partner-specific waybill function
    const waybill = await partnerModule.getNextWaybill();

    return waybill;

  } catch (error) {
    throw error;
  }
};

/**
 * Get multiple waybills from a shipping partner
 * @param {string} courierCode - The courier code
 * @param {number} count - Number of waybills to fetch
 * @returns {Array} - Array of waybill numbers
 */
export const getBulkWaybills = async (courierCode, count = 5) => {
  try {
    const partnerDetails = await getPartnerDetails(courierCode);

    if (!partnerDetails) {
      throw new Error(`Partner details not found for ${courierCode}`);
    }

    // Check if partner module exists and has bulk waybill functionality
    const partnerModule = courierModules[courierCode.toUpperCase()];

    if (!partnerModule || !partnerModule.getBulkWaybills) {
      throw new Error(`Bulk waybill functionality not available for ${courierCode}`);
    }

    // Call the partner-specific bulk waybill function
    const waybills = await partnerModule.getBulkWaybills(count);

    return waybills;

  } catch (error) {
    throw error;
  }
};

export default {
  calculateShippingRates,
  getPartnerDetails,
  bookShipment,
  bookShipmentForSeller,
  trackShipment,
  getNextWaybill,
  getBulkWaybills
};
