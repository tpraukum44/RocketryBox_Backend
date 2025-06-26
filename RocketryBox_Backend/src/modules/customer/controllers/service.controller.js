import { AppError } from '../../../middleware/errorHandler.js';
import rateCardService from '../../../services/ratecard.service.js';
import { logger } from '../../../utils/logger.js';

// List available services
export const listServices = async (req, res, next) => {
  try {
    // Get active couriers from the unified rate card system
    const couriersResult = await rateCardService.getActiveCouriers();
    
    if (!couriersResult.success) {
      throw new AppError('Failed to fetch available services', 500);
    }

    // Transform courier data into service offerings
    const services = couriersResult.couriers.map(courier => ({
      id: courier.toLowerCase(),
      name: `${courier} Delivery`,
      description: `Reliable delivery service via ${courier}`,
      type: 'standard',
      courier: courier,
      estimatedDelivery: '3-5 business days',
      features: [
        'Free pickup',
        'Online tracking',
        'SMS updates',
        'Email notifications'
      ]
    }));

    // Add COD service options
    services.push({
      id: 'cod',
      name: 'Cash on Delivery',
      description: 'Pay when you receive your package',
      type: 'cod',
      estimatedDelivery: '3-5 business days',
      features: [
        'Free pickup',
        'Online tracking',
        'SMS updates',
        'Email notifications',
        'Cash on delivery'
      ]
    });

    res.status(200).json({
      success: true,
      data: {
        services
      }
    });
  } catch (error) {
    logger.error(`Error in listServices: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};

// Check service availability and calculate rates
export const checkAvailability = async (req, res, next) => {
  try {
    const { pickupPincode, deliveryPincode, package: packageDetails } = req.body;

    // Validate required parameters
    if (!pickupPincode || !deliveryPincode || !packageDetails) {
      throw new AppError('pickupPincode, deliveryPincode, and package details are required', 400);
    }

    if (!packageDetails.weight) {
      throw new AppError('Package weight is required', 400);
    }

    // Use unified rate card service to check availability and calculate rates
    const rateResult = await rateCardService.calculateShippingRate({
      fromPincode: pickupPincode,
      toPincode: deliveryPincode,
      weight: packageDetails.weight,
      dimensions: packageDetails.dimensions,
      orderType: 'prepaid',
      codCollectableAmount: packageDetails.declaredValue || 0,
      includeRTO: false
    });

    if (!rateResult.success) {
      return res.status(200).json({
        success: true,
        data: {
          available: false,
          message: rateResult.error || 'Service not available for this route'
        }
      });
    }

    // Calculate COD rates separately
    const codResult = await rateCardService.calculateShippingRate({
      fromPincode: pickupPincode,
      toPincode: deliveryPincode,
      weight: packageDetails.weight,
      dimensions: packageDetails.dimensions,
      orderType: 'cod',
      codCollectableAmount: packageDetails.declaredValue || 0,
      includeRTO: false
    });

    // Transform calculations into service options
    const services = [];

    // Add standard delivery options for each courier
    rateResult.calculations.forEach(calc => {
      services.push({
        id: `${calc.courier.toLowerCase()}-standard`,
        name: `${calc.courier} Standard`,
        courier: calc.courier,
        price: calc.totalAmount,
        estimatedDelivery: '3-5 business days',
        type: 'standard',
        zone: rateResult.zone,
        breakdown: {
          baseRate: calc.baseRate,
          additionalCharges: calc.additionalCharges,
          gst: calc.gst,
          total: calc.totalAmount
        }
      });

      // Add express option (typically 1.5x standard rate)
      services.push({
        id: `${calc.courier.toLowerCase()}-express`,
        name: `${calc.courier} Express`,
        courier: calc.courier,
        price: Math.round(calc.totalAmount * 1.5),
        estimatedDelivery: '1-2 business days',
        type: 'express',
        zone: rateResult.zone,
        breakdown: {
          baseRate: Math.round(calc.baseRate * 1.5),
          additionalCharges: Math.round(calc.additionalCharges * 1.5),
          gst: Math.round(calc.gst * 1.5),
          total: Math.round(calc.totalAmount * 1.5)
        }
      });
    });

    // Add COD options if COD calculation was successful
    if (codResult.success && codResult.calculations.length > 0) {
      codResult.calculations.forEach(calc => {
        services.push({
          id: `${calc.courier.toLowerCase()}-cod`,
          name: `${calc.courier} COD`,
          courier: calc.courier,
          price: calc.totalAmount,
          estimatedDelivery: '3-5 business days',
          type: 'cod',
          zone: codResult.zone,
          breakdown: {
            baseRate: calc.baseRate,
            additionalCharges: calc.additionalCharges,
            codCharges: calc.codCharges,
            gst: calc.gst,
            total: calc.totalAmount
          }
        });
      });
    }

    // Sort services by price (cheapest first)
    services.sort((a, b) => a.price - b.price);

    res.status(200).json({
      success: true,
      data: {
        available: true,
        services,
        zone: rateResult.zone,
        chargeableWeight: rateResult.chargeableWeight,
        requestDetails: {
          pickupPincode,
          deliveryPincode,
          weight: packageDetails.weight,
          dimensions: packageDetails.dimensions
        }
      }
    });
  } catch (error) {
    logger.error(`Error in checkAvailability: ${error.message}`);
    next(new AppError(error.message, 400));
  }
}; 