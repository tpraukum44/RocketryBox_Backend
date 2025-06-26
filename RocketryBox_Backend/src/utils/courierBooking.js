import * as bluedart from './bluedart.js';
import * as delhivery from './delhivery.js';
import * as dtdc from './dtdc.js';
import * as ecomexpress from './ecomexpress.js';
import * as ekart from './ekart.js';
import { logger } from './logger.js';
import { getPartnerDetails } from './shipping.js';
import * as xpressbees from './xpressbees.js';

// Map of courier codes to their respective modules
const courierModules = {
  BLUEDART: bluedart,
  DELHIVERY: delhivery,
  DTDC: dtdc,
  ECOMEXPRESS: ecomexpress,
  EKART: ekart,
  XPRESSBEES: xpressbees
};

/**
 * Courier factory that returns the appropriate courier service handler
 * based on the courier code
 * @param {string} courierCode - The courier code (e.g., 'BLUEDART', 'DELHIVERY')
 * @returns {Object} - The courier handler with methods for rate calculation, booking, etc.
 */
export const getCourierHandler = async (courierCode) => {
  try {
    // Standardize courier code
    const normalizedCode = courierCode.toUpperCase();

    // Get partner configuration from database
    const partnerDetails = await getPartnerDetails(courierCode);

    if (!partnerDetails) {
      throw new Error(`Partner configuration not found for ${courierCode}`);
    }

    // Check if courier module exists
    const courierModule = courierModules[normalizedCode];

    if (!courierModule) {
      throw new Error(`Courier module not found for ${courierCode}`);
    }

    // Return a handler with methods that use the partner details
    return {
      calculateRate: (packageDetails, deliveryDetails) =>
        courierModule.calculateRate(packageDetails, deliveryDetails, partnerDetails),

      bookShipment: (shipmentDetails) =>
        courierModule.bookShipment(shipmentDetails, partnerDetails),

      trackShipment: (trackingNumber) =>
        courierModule.trackShipment(trackingNumber, partnerDetails),

      partnerDetails: {
        id: partnerDetails.id,
        name: partnerDetails.name,
        serviceTypes: partnerDetails.serviceTypes,
        weightLimits: partnerDetails.weightLimits,
        dimensionLimits: partnerDetails.dimensionLimits
      }
    };
  } catch (error) {
    logger.error(`Error getting courier handler for ${courierCode}: ${error.message}`);
    return null;
  }
};

/**
 * Book a shipment with the specified courier
 * @param {string} courierCode - The courier code
 * @param {Object} shipmentDetails - The shipment details
 * @returns {Object} - The booking response
 */
export const bookShipment = async (courierCode, shipmentDetails) => {
  try {
    const courierHandler = await getCourierHandler(courierCode);

    if (!courierHandler) {
      throw new Error(`Could not initialize handler for ${courierCode}`);
    }

    return await courierHandler.bookShipment(shipmentDetails);
  } catch (error) {
    logger.error(`Error booking shipment with ${courierCode}: ${error.message}`);
    return {
      success: false,
      error: error.message,
      courierName: courierCode
    };
  }
};

/**
 * Book an order with a courier service
 * @param {Object} order - The order data
 * @param {string} courierCode - The courier code
 * @returns {Object} - The booking response
 */
export const bookOrderWithCourier = async (order, courierCode) => {
  try {
    // Map order data to shipment details format
    const shipmentDetails = {
      consignee: {
        name: order.customer.name,
        phone: order.customer.phone,
        email: order.customer.email,
        address: order.shippingAddress
      },
      shipper: {
        name: order.seller.businessName,
        phone: order.seller.phone,
        email: order.seller.email,
        address: order.pickupAddress
      },
      package: {
        weight: order.package.weight,
        dimensions: order.package.dimensions,
        description: `Order #${order.orderNumber}`,
        value: order.total
      },
      referenceNumber: order.orderNumber,
      serviceType: order.serviceType || 'Standard',
      cod: order.paymentMethod === 'COD',
      codAmount: order.paymentMethod === 'COD' ? order.total : 0
    };

    // Book the shipment
    return await bookShipment(courierCode, shipmentDetails);
  } catch (error) {
    logger.error(`Error in bookOrderWithCourier: ${error.message}`);
    return {
      success: false,
      error: error.message,
      courierName: courierCode
    };
  }
};

export default {
  getCourierHandler,
  bookShipment,
  bookOrderWithCourier
};
