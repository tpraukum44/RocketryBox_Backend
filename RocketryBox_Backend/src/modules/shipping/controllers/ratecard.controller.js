import rateCardService from '../../../services/ratecard.service.js';
import { logger } from '../../../utils/logger.js';

/**
 * Rate Card Controller
 * Handles HTTP requests for rate card operations
 */

class RateCardController {
  /**
   * Get all rate cards
   */
  async getAllRateCards(req, res) {
    try {
      const { courier, zone, mode } = req.query;
      const filters = {};
      
      if (courier) filters.courier = courier;
      if (zone) filters.zone = zone;
      if (mode) filters.mode = mode;

      const result = await rateCardService.getAllRateCards(filters);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.rateCards,
        count: result.count,
        filters
      });
    } catch (error) {
      logger.error('Error in getAllRateCards:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get rate cards by zone
   */
  async getRateCardsByZone(req, res) {
    try {
      const { zone } = req.params;
      const { courier } = req.query;

      if (!zone) {
        return res.status(400).json({
          success: false,
          error: 'Zone parameter is required'
        });
      }

      const result = await rateCardService.getRateCardsByZone(zone, courier);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.rateCards,
        zone: result.zone,
        count: result.count
      });
    } catch (error) {
      logger.error('Error in getRateCardsByZone:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get rate cards by courier
   */
  async getRateCardsByCourier(req, res) {
    try {
      const { courier } = req.params;

      if (!courier) {
        return res.status(400).json({
          success: false,
          error: 'Courier parameter is required'
        });
      }

      const result = await rateCardService.getRateCardsByCourier(courier);

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.rateCards,
        courier: result.courier,
        count: result.count
      });
    } catch (error) {
      logger.error('Error in getRateCardsByCourier:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get all active couriers
   */
  async getActiveCouriers(req, res) {
    try {
      const result = await rateCardService.getActiveCouriers();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.couriers
      });
    } catch (error) {
      logger.error('Error in getActiveCouriers:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Calculate shipping rate
   */
  async calculateShippingRate(req, res) {
    try {
      const {
        zone, // Direct zone input (for testing/admin)
        fromPincode, // Automatic zone determination
        toPincode, // Automatic zone determination
        weight,
        length,
        width,
        height,
        orderType = 'prepaid',
        codCollectableAmount = 0,
        includeRTO = false,
        courier = null
      } = req.body;

      // Validate required fields - either zone OR pincodes must be provided
      if (!zone && (!fromPincode || !toPincode)) {
        return res.status(400).json({
          success: false,
          error: 'Either zone OR both fromPincode and toPincode must be provided'
        });
      }

      if (!weight || !length || !width || !height) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: weight, length, width, height'
        });
      }

      // Validate numeric fields
      const numericFields = { weight, length, width, height, codCollectableAmount };
      for (const [field, value] of Object.entries(numericFields)) {
        if (isNaN(value) || value < 0) {
          return res.status(400).json({
            success: false,
            error: `Invalid ${field}: must be a positive number`
          });
        }
      }

      const calculationData = {
        weight: Number(weight),
        dimensions: {
          length: Number(length),
          width: Number(width),
          height: Number(height)
        },
        orderType,
        codCollectableAmount: Number(codCollectableAmount),
        includeRTO: Boolean(includeRTO),
        courier
      };

      // Add zone directly or pincodes for automatic determination
      if (zone) {
        // For legacy compatibility and testing - calculate with direct zone
        // We'll need to modify the service to accept zone directly
        calculationData.zone = zone;
        calculationData.fromPincode = '110001'; // Dummy values for service compatibility
        calculationData.toPincode = '110002';
      } else {
        calculationData.fromPincode = fromPincode;
        calculationData.toPincode = toPincode;
      }

      const result = await rateCardService.calculateShippingRate(calculationData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: {
          calculations: result.calculations,
          inputData: result.inputData,
          cheapestOption: result.calculations[0],
          totalOptions: result.calculations.length,
          zone: result.zone,
          billedWeight: result.billedWeight,
          deliveryEstimate: result.deliveryEstimate
        }
      });
    } catch (error) {
      logger.error('Error in calculateShippingRate:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Get rate card statistics
   */
  async getStatistics(req, res) {
    try {
      const result = await rateCardService.getStatistics();

      if (!result.success) {
        return res.status(500).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.statistics
      });
    } catch (error) {
      logger.error('Error in getStatistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Create or update rate card (Admin only)
   */
  async createOrUpdateRateCard(req, res) {
    try {
      const rateCardData = req.body;

      // Validate required fields
      const requiredFields = ['courier', 'productName', 'mode', 'zone', 'baseRate', 'addlRate'];
      const missingFields = requiredFields.filter(field => !rateCardData[field]);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `Missing required fields: ${missingFields.join(', ')}`
        });
      }

      const result = await rateCardService.createOrUpdateRateCard(rateCardData);

      if (!result.success) {
        return res.status(400).json({
          success: false,
          error: result.error
        });
      }

      res.status(result.isNew ? 201 : 200).json({
        success: true,
        data: result.rateCard,
        message: result.isNew ? 'Rate card created successfully' : 'Rate card updated successfully'
      });
    } catch (error) {
      logger.error('Error in createOrUpdateRateCard:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Deactivate rate card (Admin only)
   */
  async deactivateRateCard(req, res) {
    try {
      const { id } = req.params;

      if (!id) {
        return res.status(400).json({
          success: false,
          error: 'Rate card ID is required'
        });
      }

      const result = await rateCardService.deactivateRateCard(id);

      if (!result.success) {
        return res.status(404).json({
          success: false,
          error: result.error
        });
      }

      res.json({
        success: true,
        data: result.rateCard,
        message: 'Rate card deactivated successfully'
      });
    } catch (error) {
      logger.error('Error in deactivateRateCard:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error'
      });
    }
  }

  /**
   * Health check for rate card service
   */
  async healthCheck(req, res) {
    try {
      const result = await rateCardService.healthCheck();

      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      logger.error('Error in rate card health check:', error);
      res.status(500).json({
        success: false,
        status: 'unhealthy',
        error: 'Internal server error',
        timestamp: new Date().toISOString()
      });
    }
  }
}

export default new RateCardController(); 