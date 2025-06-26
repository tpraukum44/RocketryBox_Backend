import { bookShipmentForSeller, trackShipment } from '../utils/shipping.js';

/**
 * ARCHITECTURAL NOTE:
 * - Seller section uses B2B APIs only (bookShipmentForSeller)
 * - Customer section uses B2C APIs only (bookShipment)
 * - This service handles SELLER shipments, so it uses B2B methods only
 */

/**
 * Seller Shipment Booking Service - Handles B2B courier partner integration
 * NO MOCK/TEMPORARY AWBs - Only real AWBs from courier partners
 * FOR SELLER SECTION ONLY - Uses B2B APIs
 */
export class SellerShipmentBookingService {

  /**
   * Book shipment with selected courier partner for SELLER operations
   * @param {Object} shipmentData - Shipment details
   * @param {Object} selectedProvider - Chosen courier provider
   * @returns {Object} - Booking response with real AWB or raw error
   */
  static async bookShipmentWithCourier(shipmentData, selectedProvider) {
    try {
      // Validate input parameters
      if (!selectedProvider || !selectedProvider.name) {
        throw new Error('Invalid selectedProvider: missing name property');
      }

      if (!shipmentData || !shipmentData.orderId) {
        throw new Error('Invalid shipmentData: missing orderId property');
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
        'DTDC': 'DTDC',
        'Dtdc': 'DTDC',
        'DTDC Express': 'DTDC',
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

      // Prepare shipment details for B2B courier API
      const shipmentDetails = {
        // Order reference
        orderId: shipmentData.orderId || `ORDER_${Date.now()}`,
        orderNumber: shipmentData.orderId || `ORDER_${Date.now()}`,
        invoiceNumber: `INV_${shipmentData.orderId || Date.now()}`,
        orderValue: shipmentData.totalAmount || shipmentData.shippingRate,

        // Sender details (pickup address) - Transform to expected format
        senderName: shipmentData.pickupAddress?.name || 'RocketryBox Seller',
        senderAddress: this.formatAddress(shipmentData.pickupAddress?.address),
        senderPincode: shipmentData.pickupAddress?.address?.pincode,
        senderPhone: shipmentData.pickupAddress?.phone || '9999999999',
        senderEmail: shipmentData.pickupAddress?.email || 'seller@rocketrybox.com',

        // Receiver details (delivery address) - Transform to expected format
        receiverName: shipmentData.deliveryAddress?.name,
        receiverAddress: this.formatAddress(shipmentData.deliveryAddress?.address),
        receiverPincode: shipmentData.deliveryAddress?.address?.pincode,
        receiverPhone: shipmentData.deliveryAddress?.phone,
        receiverEmail: shipmentData.deliveryAddress?.email || 'buyer@example.com',

        // Package details
        weight: shipmentData.packageDetails?.weight || 1,
        dimensions: shipmentData.packageDetails?.dimensions || { length: 10, width: 10, height: 10 },
        declaredValue: shipmentData.packageDetails?.declaredValue || shipmentData.totalAmount || 100,
        package: {
          weight: shipmentData.packageDetails?.weight || 1,
          dimensions: shipmentData.packageDetails?.dimensions || { length: 10, width: 10, height: 10 },
          declaredValue: shipmentData.packageDetails?.declaredValue || shipmentData.totalAmount || 100
        },

        // Service configuration for B2B
        serviceType: selectedProvider.serviceType || 'standard',
        paymentMode: shipmentData.paymentMode || 'Prepaid',
        codAmount: shipmentData.codAmount || 0,
        cod: shipmentData.cod || false,

        // Product details
        products: [{
          name: 'Seller Product',
          quantity: 1,
          value: shipmentData.packageDetails?.declaredValue || 100,
          hsn: '9999'
        }],
        commodity: 'General Goods',
        category: 'General',

        // Additional details
        instructions: shipmentData.instructions || '',
        pickupDate: shipmentData.pickupDate || new Date(),

        // B2B specific fields
        platform: 'RocketryBox-Seller',
        source: 'Seller Portal',
        businessType: 'B2B',

        // Transform to B2B expected format (shipper/consignee)
        shipper: {
          name: shipmentData.pickupAddress?.name || 'RocketryBox Seller',
          phone: shipmentData.pickupAddress?.phone || '9999999999',
          email: shipmentData.pickupAddress?.email || 'seller@rocketrybox.com',
          gstNumber: shipmentData.sellerGstNumber || '', // B2B specific
          address: {
            line1: shipmentData.pickupAddress?.address?.line1 || '',
            line2: shipmentData.pickupAddress?.address?.line2 || '',
            city: shipmentData.pickupAddress?.address?.city || '',
            state: shipmentData.pickupAddress?.address?.state || '',
            pincode: shipmentData.pickupAddress?.address?.pincode || '',
            country: shipmentData.pickupAddress?.address?.country || 'India'
          }
        },
        consignee: {
          name: shipmentData.deliveryAddress?.name,
          phone: shipmentData.deliveryAddress?.phone,
          email: shipmentData.deliveryAddress?.email || 'buyer@example.com',
          gstNumber: shipmentData.buyerGstNumber || '', // B2B specific
          address: {
            line1: shipmentData.deliveryAddress?.address?.line1 || '',
            line2: shipmentData.deliveryAddress?.address?.line2 || '',
            city: shipmentData.deliveryAddress?.address?.city || '',
            state: shipmentData.deliveryAddress?.address?.state || '',
            pincode: shipmentData.deliveryAddress?.address?.pincode || '',
            country: shipmentData.deliveryAddress?.address?.country || 'India'
          }
        }
      };

      // Enhanced logging for B2B operations
      console.log(`🏢 B2B Shipment Booking for ${selectedProvider.name}:`, {
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
        businessType: shipmentDetails.businessType,
        platform: shipmentDetails.platform
      });

      // Only try the selected courier - NO FALLBACKS
      const providersToTry = [
        { code: courierCode, name: selectedProvider.name }
      ];

      let rawResponses = [];

      // Try ONLY the selected courier partner
      const provider = providersToTry[0];
      try {
        console.log(`🚚 B2B: Attempting shipment booking with ${provider.name} (${provider.code})`);

        // Call real courier API for shipment booking
        const bookingResponse = await bookShipmentForSeller(provider.code, shipmentDetails);

        // Store raw response for debugging
        rawResponses.push({
          courier: provider.name,
          code: provider.code,
          rawResponse: bookingResponse,
          timestamp: new Date().toISOString()
        });

        // Accept any AWB returned from courier API - no validation needed
        if (bookingResponse.success && bookingResponse.awb) {
          console.log(`✅ Successfully generated B2B AWB from ${provider.name}: ${bookingResponse.awb}`);

          return {
            success: true,
            awb: bookingResponse.awb,
            courierName: provider.name,
            courierCode: provider.code,
            trackingUrl: bookingResponse.trackingUrl,
            orderId: bookingResponse.orderId,
            rawResponse: bookingResponse,
            message: `B2B Shipment created successfully with ${provider.name}`,
            bookingType: 'B2B_API'
          };
        } else {
          // Log raw API response without processing
          console.log(`RAW B2B API ERROR: ${JSON.stringify({
            courier: provider.name,
            code: provider.code,
            rawResponse: bookingResponse,
            timestamp: new Date().toISOString()
          }, null, 2)}`);

          throw new Error(`B2B AWB generation failed: ${bookingResponse.error || 'No AWB in response'}`);
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
        throw new Error(`RAW B2B API ERROR: ${JSON.stringify(rawResponses[0], null, 2)}`);
      }

    } catch (error) {
      // Enhanced error logging for B2B operations
      console.log('🔥 SellerShipmentBookingService.bookShipmentWithCourier B2B ERROR:', {
        selectedProvider: selectedProvider.name,
        shipmentData: {
          orderId: shipmentData.orderId,
          pickupPincode: shipmentData.pickupAddress?.address?.pincode,
          deliveryPincode: shipmentData.deliveryAddress?.address?.pincode,
          weight: shipmentData.packageDetails?.weight
        },
        error: error.message,
        businessType: 'B2B'
      });

      // Return enhanced error with B2B-specific guidance
      throw new Error(`B2B courier booking failed: ${error.message}`);
    }
  }

  /**
   * Get real-time tracking from courier partner for B2B shipments
   */
  static async getRealtimeTracking(awb, courierCode) {
    try {
      const trackingResponse = await trackShipment(awb, courierCode);

      if (trackingResponse.success) {
        // B2B tracking may have additional fields
        console.log(`🏢 B2B Tracking updated for AWB: ${awb}`);
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

  static calculateEstimatedDelivery(estimatedDays) {
    const days = parseInt(estimatedDays) || 5;
    const deliveryDate = new Date();
    deliveryDate.setDate(deliveryDate.getDate() + days);
    return deliveryDate;
  }

}

export default SellerShipmentBookingService;
