import { AppError } from '../../../middleware/errorHandler.js';
import SellerRateCard from '../../../models/sellerRateCard.model.js';
import rateCardService from '../../../services/ratecard.service.js';
import { logger } from '../../../utils/logger.js';

// Helper function to transform rate cards into frontend table format
const transformRateCardsToTableFormat = async (rateCards) => {
  try {
    // Group rate cards by courier and mode for easier processing
    const ratesByMode = {};

    rateCards.forEach(card => {
      const key = `${card.courier}-${card.mode}`;
      if (!ratesByMode[key]) {
        ratesByMode[key] = {
          mode: `${card.courier} ${card.mode}`,
          courier: card.courier,
          productName: card.productName,
          zones: {}
        };
      }

      // Map backend zone names to frontend zone structure
      const zoneMapping = {
        'Within City': 'withinCity',
        'Within State': 'withinState',
        'Within Region': 'withinState', // Map to within state for simplicity
        'Metro to Metro': 'metroToMetro',
        'Rest of India': 'restOfIndia',
        'Special Zone': 'northEastJK',
        'North East & Special Areas': 'northEastJK'
      };

      const frontendZone = zoneMapping[card.zone] || 'restOfIndia';

      ratesByMode[key].zones[frontendZone] = {
        base: `₹${card.baseRate || 0}`,
        additional: `₹${card.addlRate || 0}`,
        rto: `₹${card.rtoCharges || (card.baseRate || 0)}` // Use base rate as RTO if not specified
      };

      // Add COD information from the rate card
      ratesByMode[key].cod = `₹${card.codAmount || 0}`;
      ratesByMode[key].codPercent = `${card.codPercent || 2}%`;
    });

    // Convert to array and fill missing zones with default values
    const transformedRates = Object.values(ratesByMode).map(rate => {
      const defaultZone = { base: '₹0', additional: '₹0', rto: '₹0' };

      return {
        mode: rate.mode,
        withinCity: rate.zones.withinCity || defaultZone,
        withinState: rate.zones.withinState || defaultZone,
        metroToMetro: rate.zones.metroToMetro || defaultZone,
        restOfIndia: rate.zones.restOfIndia || defaultZone,
        northEastJK: rate.zones.northEastJK || defaultZone,
        cod: rate.cod || '₹15',
        codPercent: rate.codPercent || '2%'
      };
    });

    return transformedRates;
  } catch (error) {
    logger.error('Error transforming rate cards to table format:', error);
    // Return empty format if transformation fails
    return [];
  }
};

// Get seller's effective rate cards (base + overrides)
export const getSellerRateCard = async (req, res, next) => {
  try {
    const sellerId = req.user.id; // Get seller ID from authenticated user

    // Get effective rate cards for this seller (base + overrides)
    const effectiveRates = await SellerRateCard.getSellerEffectiveRates(sellerId);

    if (!effectiveRates || effectiveRates.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          rateCards: [],
          rateCardsByCourier: {},
          totalCount: 0,
          message: 'No rate cards available. Please contact admin to set up your rates.'
        }
      });
    }

    // Group rate cards by courier for easier frontend consumption
    const rateCardsByCourier = {};
    effectiveRates.forEach(card => {
      if (!rateCardsByCourier[card.courier]) {
        rateCardsByCourier[card.courier] = [];
      }
      rateCardsByCourier[card.courier].push(card);
    });

    // Count overrides for statistics
    const overriddenRates = effectiveRates.filter(rate => rate.isOverride);
    const hasCustomRates = overriddenRates.length > 0;

    // Transform rate cards into frontend table format
    const transformedRates = await transformRateCardsToTableFormat(effectiveRates);

    // Get seller rate band information
    const seller = req.user;
    const sellerRateBand = seller.rateBand || 'RBX1';

    res.status(200).json({
      success: true,
      data: {
        rates: transformedRates,
        rateBand: sellerRateBand,
        rateBandDetails: {
          name: sellerRateBand,
          description: seller.rateBand ? 'Custom rate band assigned by admin' : 'Default rate band for all sellers',
          isDefault: sellerRateBand === 'RBX1' && !seller.rateBand,
          isCustom: !!seller.rateBand
        },
        lastUpdated: new Date().toISOString(),
        hasCustomRates,
        statistics: {
          totalRates: effectiveRates.length,
          customRates: overriddenRates.length,
          baseRates: effectiveRates.length - overriddenRates.length,
          customizationPercentage: Math.round((overriddenRates.length / effectiveRates.length) * 100)
        },
        // Legacy format for compatibility
        rateCards: effectiveRates,
        rateCardsByCourier,
        totalCount: effectiveRates.length
      }
    });
  } catch (error) {
    logger.error(`Error in getSellerRateCard for seller ${req.user.id}: ${error.message}`);
    next(error);
  }
};

// Calculate shipping rate using seller's effective rates
export const calculateShippingRate = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const {
      pickupPincode,
      deliveryPincode,
      weight,
      paymentType,
      purchaseAmount,
      packageLength,
      packageWidth,
      packageHeight
    } = req.body;

    // Validate required fields
    if (!pickupPincode || !deliveryPincode || !weight || !paymentType) {
      return next(new AppError('Pickup pincode, delivery pincode, weight, and payment type are required', 400));
    }

    // Get seller's effective rate cards
    const effectiveRates = await SellerRateCard.getSellerEffectiveRates(sellerId);

    if (!effectiveRates || effectiveRates.length === 0) {
      return next(new AppError('No rate cards available for your account. Please contact admin.', 400));
    }

    // Use the rate calculation service with seller's effective rates
    const calculationResult = await rateCardService.calculateShippingRate({
      pickupPincode,
      deliveryPincode,
      weight: parseFloat(weight),
      paymentType,
      purchaseAmount: purchaseAmount ? parseFloat(purchaseAmount) : 0,
      dimensions: {
        length: packageLength ? parseFloat(packageLength) : 0,
        width: packageWidth ? parseFloat(packageWidth) : 0,
        height: packageHeight ? parseFloat(packageHeight) : 0
      },
      rateCards: effectiveRates // Pass seller's effective rates
    });

    if (!calculationResult.success) {
      return next(new AppError(calculationResult.error, 400));
    }

    // Add seller-specific information to the response
    const response = {
      ...calculationResult,
      sellerInfo: {
        hasCustomRates: effectiveRates.some(rate => rate.isOverride),
        ratesLastUpdated: (() => {
          const validDates = effectiveRates
            .map(rate => {
              if (!rate.lastUpdated) return null;
              const date = new Date(rate.lastUpdated);
              return isNaN(date.getTime()) ? null : date.getTime();
            })
            .filter(date => date !== null);
          return validDates.length > 0 ? Math.max(...validDates) : Date.now();
        })()
      }
    };

    res.status(200).json({
      success: true,
      data: response
    });

  } catch (error) {
    logger.error(`Error in calculateShippingRate for seller ${req.user.id}: ${error.message}`);
    next(error);
  }
};

// Get rate comparison across different couriers for seller
export const getRateComparison = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const {
      pickupPincode,
      deliveryPincode,
      weight,
      paymentType = 'Prepaid'
    } = req.query;

    if (!pickupPincode || !deliveryPincode || !weight) {
      return next(new AppError('Pickup pincode, delivery pincode, and weight are required', 400));
    }

    // Get seller's effective rate cards
    const effectiveRates = await SellerRateCard.getSellerEffectiveRates(sellerId);

    if (!effectiveRates || effectiveRates.length === 0) {
      return next(new AppError('No rate cards available for comparison', 400));
    }

    // Calculate rates using seller's effective rates
    const calculationResult = await rateCardService.calculateShippingRate({
      fromPincode: pickupPincode,
      toPincode: deliveryPincode,
      weight: parseFloat(weight),
      orderType: paymentType.toLowerCase() === 'cod' ? 'cod' : 'prepaid',
      rateCards: effectiveRates // Pass seller's effective rates
    });

    if (!calculationResult.success) {
      return next(new AppError(calculationResult.error, 400));
    }

    // Group calculations by courier for comparison
    const courierComparison = {};
    calculationResult.calculations.forEach(calc => {
      if (!courierComparison[calc.courier]) {
        courierComparison[calc.courier] = [];
      }
      courierComparison[calc.courier].push(calc);
    });

    // Get best rate for each courier
    const bestRatesByCourier = Object.entries(courierComparison).map(([courier, rates]) => {
      const bestRate = rates.sort((a, b) => a.total - b.total)[0];
      return {
        courier,
        mode: bestRate.mode,
        rate: bestRate.total,
        estimatedDelivery: calculationResult.deliveryEstimate,
        isCustomRate: bestRate.isCustomRate || false,
        breakdown: {
          baseRate: bestRate.baseRate,
          additionalCharges: (bestRate.addlRate * (bestRate.weightMultiplier - 1)),
          codCharges: bestRate.codCharges,
          gst: bestRate.gst,
          total: bestRate.total
        }
      };
    });

    // Sort by rate (cheapest first)
    bestRatesByCourier.sort((a, b) => a.rate - b.rate);

    res.status(200).json({
      success: true,
      data: {
        zone: calculationResult.zone,
        rates: bestRatesByCourier,
        cheapestOption: bestRatesByCourier[0],
        summary: {
          totalCouriers: bestRatesByCourier.length,
          cheapestRate: bestRatesByCourier[0]?.rate,
          fastestDelivery: calculationResult.deliveryEstimate
        },
        metadata: {
          sellerId,
          hasCustomRates: effectiveRates.some(rate => rate.isOverride),
          totalAvailableCouriers: [...new Set(effectiveRates.map(rate => rate.courier))].length,
          customRatesUsed: calculationResult.calculations.filter(c => c.isCustomRate).length
        }
      }
    });

  } catch (error) {
    logger.error(`Error in getRateComparison for seller ${req.user.id}: ${error.message}`);
    next(error);
  }
};

// Get zone mapping information
export const getZoneMapping = async (req, res, next) => {
  try {
    // Provide zone mapping information directly since the service method doesn't exist
    const zoneMapping = {
      zones: [
        'Within City',
        'Within State',
        'Within Region',
        'Metro to Metro',
        'Rest of India',
        'Special Zone',
        'North East & Special Areas'
      ],
      description: {
        'Within City': 'Same city delivery',
        'Within State': 'Same state, different city',
        'Within Region': 'Same region, different state',
        'Metro to Metro': 'Between major metro cities',
        'Rest of India': 'Standard domestic delivery',
        'Special Zone': 'Remote areas, North East states',
        'North East & Special Areas': 'North East India, J&K, Islands'
      },
      deliveryTimeEstimates: {
        'Within City': { Surface: '2-3 days', Air: '1-2 days' },
        'Within State': { Surface: '3-4 days', Air: '2-3 days' },
        'Within Region': { Surface: '4-5 days', Air: '2-3 days' },
        'Metro to Metro': { Surface: '3-5 days', Air: '2-3 days' },
        'Rest of India': { Surface: '4-6 days', Air: '3-4 days' },
        'Special Zone': { Surface: '6-8 days', Air: '4-5 days' },
        'North East & Special Areas': { Surface: '6-8 days', Air: '4-5 days' }
      }
    };

    res.status(200).json({
      success: true,
      data: zoneMapping
    });
  } catch (error) {
    logger.error(`Error in getZoneMapping: ${error.message}`);
    next(error);
  }
};

// Get rate card statistics for seller dashboard
export const getRateCardStatistics = async (req, res, next) => {
  try {
    const sellerId = req.user.id;

    // Get seller's effective rate cards
    const effectiveRates = await SellerRateCard.getSellerEffectiveRates(sellerId);

    // Calculate seller-specific statistics
    const courierStats = {};
    const zoneStats = {};
    const modeStats = {};
    let customRatesCount = 0;

    effectiveRates.forEach(rate => {
      // Count by courier
      courierStats[rate.courier] = (courierStats[rate.courier] || 0) + 1;

      // Count by zone
      zoneStats[rate.zone] = (zoneStats[rate.zone] || 0) + 1;

      // Count by mode
      modeStats[rate.mode] = (modeStats[rate.mode] || 0) + 1;

      // Count custom rates
      if (rate.isOverride) {
        customRatesCount++;
      }
    });

    const statistics = {
      totalRateCards: effectiveRates.length,
      customRates: customRatesCount,
      baseRates: effectiveRates.length - customRatesCount,
      customizationPercentage: effectiveRates.length > 0 ?
        Math.round((customRatesCount / effectiveRates.length) * 100) : 0,
      byCategory: {
        courier: Object.entries(courierStats).map(([name, count]) => ({ name, count })),
        zone: Object.entries(zoneStats).map(([name, count]) => ({ name, count })),
        mode: Object.entries(modeStats).map(([name, count]) => ({ name, count }))
      },
      lastUpdated: effectiveRates.length > 0 ? (() => {
        try {
          const validDates = effectiveRates
            .map(rate => rate.lastUpdated || rate.updatedAt || rate.createdAt)
            .filter(date => date && !isNaN(new Date(date).getTime()))
            .map(date => new Date(date).getTime());
          return validDates.length > 0 ? Math.max(...validDates) : Date.now();
        } catch (error) {
          logger.warn('Error processing lastUpdated dates:', error);
          return Date.now();
        }
      })() : null
    };

    res.status(200).json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error(`Error in getRateCardStatistics for seller ${req.user.id}: ${error.message}`);
    next(error);
  }
};
