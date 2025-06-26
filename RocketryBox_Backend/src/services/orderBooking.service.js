import CustomerOrder from '../modules/customer/models/customerOrder.model.js';
import { emitEvent, EVENT_TYPES } from '../utils/events.js';
import { bookShipment, trackShipment } from '../utils/shipping.js';

/**
 * ARCHITECTURAL NOTE:
 * - Customer section uses B2C APIs only (bookShipment)
 * - Seller section uses B2B APIs only (bookShipmentForSeller)
 * - This service handles CUSTOMER orders, so it uses B2C methods only
 */

/**
 * Order Booking Service - Handles real courier partner integration
 * NO MOCK/TEMPORARY AWBs - Only real AWBs from courier partners
 * FOR CUSTOMER SECTION ONLY - Uses B2C APIs
 */
export class OrderBookingService {

  /**
   * Book shipment with selected courier partner after payment verification
   * @param {Object} orderData - Order details
   * @param {Object} selectedProvider - Chosen courier provider
   * @returns {Object} - Booking response with real AWB or raw error
   */
  static async bookShipmentWithCourier(orderData, selectedProvider) {
    try {
      // Validate input parameters
      if (!selectedProvider || !selectedProvider.name) {
        throw new Error('Invalid selectedProvider: missing name property');
      }

      if (!orderData || !orderData.orderId) {
        throw new Error('Invalid orderData: missing orderId property');
      }

      // Map courier name to courier code for API integration
      const courierMapping = {
        'Delhivery': 'DELHIVERY',
        'DELHIVERY': 'DELHIVERY',  // Handle uppercase
        'Delivery Service': 'DELHIVERY',  // Fix for misspelling issue
        'BlueDart': 'BLUEDART',
        'BLUEDART': 'BLUEDART',  // Handle uppercase
        'BlueDart+': 'BLUEDART',
        'Blue Dart Express': 'BLUEDART',
        'Blue Dart': 'BLUEDART',
        'Ekart Logistics': 'EKART',
        'eKart': 'EKART',
        'Ekart': 'EKART',
        'EKART': 'EKART',
        'XpressBees': 'XPRESSBEES',
        'XPRESSBEES': 'XPRESSBEES',  // Handle uppercase
        'Xpressbees': 'XPRESSBEES',
        'XBees': 'XPRESSBEES',
        'Ecom Express': 'ECOMEXPRESS',
        'ECOMEXPRESS': 'ECOMEXPRESS',  // Handle uppercase
        'EcomExpress': 'ECOMEXPRESS',
        'Ecom': 'ECOMEXPRESS'
      };

      const courierCode = courierMapping[selectedProvider.name];
      if (!courierCode) {
        throw new Error(`Unsupported courier partner: ${selectedProvider.name}. Available couriers: ${Object.keys(courierMapping).join(', ')}`);
      }

      // Prepare shipment details for courier API
      const shipmentDetails = {
        // Order reference
        orderId: orderData.orderId || `ORDER_${Date.now()}`,
        orderNumber: orderData.orderId || `ORDER_${Date.now()}`,
        invoiceNumber: `INV_${orderData.orderId || Date.now()}`,
        orderValue: orderData.totalAmount || orderData.shippingRate,

        // Sender details (pickup address) - Transform to expected format
        senderName: orderData.pickupAddress?.name || 'RocketryBox Sender',
        senderAddress: this.formatAddress(orderData.pickupAddress?.address),
        senderPincode: orderData.pickupAddress?.address?.pincode,
        senderPhone: orderData.pickupAddress?.phone || '9999999999',
        senderEmail: orderData.pickupAddress?.email || 'sender@rocketrybox.com',

        // Receiver details (delivery address) - Transform to expected format
        receiverName: orderData.deliveryAddress?.name,
        receiverAddress: this.formatAddress(orderData.deliveryAddress?.address),
        receiverPincode: orderData.deliveryAddress?.address?.pincode,
        receiverPhone: orderData.deliveryAddress?.phone,
        receiverEmail: orderData.deliveryAddress?.email || 'customer@example.com',

        // Package details - Fixed property names for Ekart API
        weight: orderData.packageDetails?.weight || 1,
        dimensions: orderData.packageDetails?.dimensions || { length: 10, width: 10, height: 10 },
        declaredValue: orderData.packageDetails?.declaredValue || orderData.totalAmount || 100,
        package: {
          weight: orderData.packageDetails?.weight || 1,
          dimensions: orderData.packageDetails?.dimensions || { length: 10, width: 10, height: 10 },
          declaredValue: orderData.packageDetails?.declaredValue || orderData.totalAmount || 100
        },

        // Service configuration
        serviceType: selectedProvider.serviceType || 'standard',
        paymentMode: 'Prepaid', // Since payment is already verified
        codAmount: 0, // Prepaid order
        cod: false, // Prepaid shipment

        // Product details
        products: [{
          name: 'Package',
          quantity: 1,
          value: orderData.packageDetails?.declaredValue || 100,
          hsn: '9999'
        }],
        commodity: 'General Goods',
        category: 'General',

        // Additional details
        instructions: orderData.instructions || '',
        pickupDate: orderData.pickupDate || new Date(),

        // RocketryBox specific
        platform: 'RocketryBox',
        source: 'Customer Portal',

        // Transform to Ekart expected format (shipper/consignee)
        shipper: {
          name: orderData.pickupAddress?.name || 'RocketryBox Sender',
          phone: orderData.pickupAddress?.phone || '9999999999',
          email: orderData.pickupAddress?.email || 'sender@rocketrybox.com',
          gstNumber: '', // Add if available
          address: {
            line1: orderData.pickupAddress?.address?.line1 || '',
            line2: orderData.pickupAddress?.address?.line2 || '',
            city: orderData.pickupAddress?.address?.city || '',
            state: orderData.pickupAddress?.address?.state || '',
            pincode: orderData.pickupAddress?.address?.pincode || '',
            country: orderData.pickupAddress?.address?.country || 'India'
          }
        },
        consignee: {
          name: orderData.deliveryAddress?.name,
          phone: orderData.deliveryAddress?.phone,
          email: orderData.deliveryAddress?.email || 'customer@example.com',
          gstNumber: '', // Add if available
          address: {
            line1: orderData.deliveryAddress?.address?.line1 || '',
            line2: orderData.deliveryAddress?.address?.line2 || '',
            city: orderData.deliveryAddress?.address?.city || '',
            state: orderData.deliveryAddress?.address?.state || '',
            pincode: orderData.deliveryAddress?.address?.pincode || '',
            country: orderData.deliveryAddress?.address?.country || 'India'
          }
        }
      };

      // Add detailed logging for Ekart debugging
      if (courierCode === 'EKART') {
        console.log('🔍 EKART BOOKING DEBUG - Shipment Details:', {
          orderNumber: shipmentDetails.orderNumber,
          shipper: {
            name: shipmentDetails.shipper.name,
            pincode: shipmentDetails.shipper.address.pincode,
            city: shipmentDetails.shipper.address.city
          },
          consignee: {
            name: shipmentDetails.consignee.name,
            pincode: shipmentDetails.consignee.address.pincode,
            city: shipmentDetails.consignee.address.city
          },
          package: {
            weight: shipmentDetails.weight,
            dimensions: shipmentDetails.dimensions,
            declaredValue: shipmentDetails.declaredValue
          },
          paymentMode: shipmentDetails.paymentMode,
          cod: shipmentDetails.cod
        });
      }

      // Only try the selected courier - NO FALLBACKS
      // User specifically chose this courier, respect their choice
      const providersToTry = [
        { code: courierCode, name: selectedProvider.name }
      ];

      let rawResponses = [];
      let authenticationErrors = [];

      // Try ONLY the selected courier partner
      const provider = providersToTry[0];
      try {
        console.log(`Calling ${provider.name} API...`);

        // Call real courier API for shipment booking
        const bookingResponse = await bookShipment(provider.code, shipmentDetails);

        // Store raw response for debugging
        rawResponses.push({
          courier: provider.name,
          code: provider.code,
          rawResponse: bookingResponse,
          timestamp: new Date().toISOString()
        });

        // Accept any AWB returned from courier API - no validation needed
        if (bookingResponse.success && bookingResponse.awb) {
          console.log(`✅ AWB: ${bookingResponse.awb}`);

          return {
            success: true,
            awb: bookingResponse.awb,
            courierName: provider.name,
            courierCode: provider.code,
            trackingUrl: bookingResponse.trackingUrl,
            orderId: bookingResponse.orderId,
            rawResponse: bookingResponse,
            message: `Shipment created successfully with ${provider.name}`
          };
        } else {
          throw new Error(`AWB generation failed: ${bookingResponse.error || 'No AWB in response'}`);
        }
      } catch (providerError) {
        // Store raw error response
        rawResponses.push({
          courier: provider.name,
          code: provider.code,
          error: providerError.message,
          stack: providerError.stack,
          rawError: providerError,
          timestamp: new Date().toISOString()
        });

        // Return raw API response without analysis
        throw new Error(`RAW API ERROR: ${JSON.stringify(rawResponses[0], null, 2)}`);
      }

    } catch (error) {
      // Enhanced error logging with more context
      console.log('🔥 OrderBookingService.bookShipmentWithCourier CRITICAL ERROR:', {
        originalSelectedProvider: selectedProvider.name,
        orderData: {
          orderId: orderData.orderId,
          pickupPincode: orderData.pickupAddress?.address?.pincode,
          deliveryPincode: orderData.deliveryAddress?.address?.pincode,
          weight: orderData.packageDetails?.weight
        },
        error: error.message,
        stack: error.stack?.split('\n').slice(0, 3) // First 3 lines of stack trace
      });

      // Return enhanced error with specific recommendations
      throw new Error(`Professional courier booking failed: ${error.message}`);
    }
  }

  /**
   * Analyze booking failures and provide professional guidance
   */
  static analyzeBookingFailures(rawResponses, authenticationErrors, providersAttempted) {
    const totalProviders = providersAttempted.length;
    const authFailures = authenticationErrors.length;

    if (authFailures === totalProviders) {
      // All failures were authentication-related
      return {
        category: 'AUTHENTICATION_ISSUES',
        userMessage: 'All courier partners failed due to authentication issues. Please check API credentials and contact support.',
        technicalDetails: authenticationErrors,
        rawResponses: rawResponses,
        recommendations: [
          'Verify API credentials in .env file',
          'Check if credentials have expired',
          'Contact courier partners for API access',
          'Run diagnostic tool to identify specific issues'
        ]
      };
    } else if (authFailures > 0) {
      // Some authentication failures, some other issues
      return {
        category: 'MIXED_ISSUES',
        userMessage: `Courier booking failed: ${authFailures}/${totalProviders} couriers have authentication issues, others have service problems. Please contact support.`,
        technicalDetails: { authenticationErrors, rawResponses },
        recommendations: [
          'Fix authentication issues first',
          'Check API service status',
          'Verify network connectivity',
          'Contact support for assistance'
        ]
      };
    } else {
      // No authentication issues, likely service problems
      return {
        category: 'SERVICE_ISSUES',
        userMessage: `All courier partners are temporarily unavailable. This is likely due to service maintenance or network issues. Please try again in a few minutes.`,
        technicalDetails: rawResponses,
        recommendations: [
          'Wait a few minutes and try again',
          'Check courier partner service status',
          'Verify internet connectivity',
          'Contact support if problem persists'
        ]
      };
    }
  }

  /**
   * Get alternative courier providers to try if primary fails
   */
  static getAlternativeProviders(primaryProvider) {
    const allProviders = [
      { code: 'DELHIVERY', name: 'Delhivery' },
      { code: 'BLUEDART', name: 'BlueDart' },
      { code: 'EKART', name: 'Ekart Logistics' },
      { code: 'XPRESSBEES', name: 'XpressBees' },
      { code: 'ECOMEXPRESS', name: 'Ecom Express' }
    ];

    // Return other providers except the primary one, in priority order
    return allProviders.filter(provider => provider.name !== primaryProvider);
  }

  /**
   * Update order tracking information from courier webhook
   */
  static async updateOrderTracking(identifier, trackingUpdate) {
    try {
      // Try to find order by trackingId first, then by awb
      let order = await CustomerOrder.findOne({ trackingId: identifier });

      if (!order) {
        order = await CustomerOrder.findOne({ awb: identifier });
      }

      if (!order) {
        return { success: false, error: 'Order not found' };
      }

      // Update order status based on courier status
      const statusMapping = {
        'Picked Up': 'confirmed',
        'In Transit': 'shipped',
        'Out for Delivery': 'shipped',
        'Delivered': 'delivered',
        'Returned': 'cancelled',
        'Failed': 'cancelled'
      };

      const newStatus = statusMapping[trackingUpdate.status] || order.status;

      // Update order
      order.status = newStatus;
      order.trackingHistory = order.trackingHistory || [];
      order.trackingHistory.push({
        status: trackingUpdate.status,
        location: trackingUpdate.location,
        timestamp: trackingUpdate.timestamp || new Date(),
        description: trackingUpdate.description,
        courierUpdate: true
      });

      if (trackingUpdate.estimatedDelivery) {
        order.estimatedDelivery = new Date(trackingUpdate.estimatedDelivery);
      }

      await order.save();

      // Emit real-time event
      emitEvent(EVENT_TYPES.ORDER_STATUS_UPDATED, {
        orderId: order._id,
        awb: order.awb,
        status: newStatus,
        location: trackingUpdate.location,
        timestamp: trackingUpdate.timestamp
      });

      return { success: true, order };

    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get real-time tracking from courier partner
   */
  static async getRealtimeTracking(awb, courierCode) {
    try {
      const trackingResponse = await trackShipment(awb, courierCode);

      if (trackingResponse.success) {
        // Update local tracking data
        await this.updateOrderTracking(awb, {
          status: trackingResponse.status,
          location: trackingResponse.currentLocation,
          timestamp: new Date(),
          description: trackingResponse.description || trackingResponse.status
        });
      }

      return trackingResponse;
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper methods
   */
  static formatAddress(address) {
    if (!address) return 'Address not provided';

    return `${address.line1 || ''} ${address.line2 || ''}, ${address.city || ''}, ${address.state || ''} ${address.pincode || ''}`.trim();
  }

  /**
   * Calculate estimated delivery based on service days
   * @param {number} days - Estimated delivery days
   * @returns {Date} Estimated delivery date
   */
  static calculateEstimatedDelivery(days = 5) {
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + days);
    return estimatedDate;
  }

}

export default OrderBookingService;
