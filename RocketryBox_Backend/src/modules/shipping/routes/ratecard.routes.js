import express from 'express';
import rateCardController from '../controllers/ratecard.controller.js';

const router = express.Router();

/**
 * Rate Card Routes
 * Base path: /api/v2/shipping/ratecards
 */

// Public routes (for rate calculation)
router.get('/', rateCardController.getAllRateCards);
router.get('/zone/:zone', rateCardController.getRateCardsByZone);
router.get('/courier/:courier', rateCardController.getRateCardsByCourier);
router.get('/couriers', rateCardController.getActiveCouriers);
router.post('/calculate', rateCardController.calculateShippingRate);
router.get('/statistics', rateCardController.getStatistics);
router.get('/health', rateCardController.healthCheck);

// Admin routes (for rate card management)
// Note: Add authentication middleware here when available
router.post('/', rateCardController.createOrUpdateRateCard);
router.patch('/:id/deactivate', rateCardController.deactivateRateCard);

export default router; 