import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import { calculateRateSchema } from '../validators/ratecard.validator.js';
import {
  getSellerRateCard,
  calculateShippingRate,
  getRateComparison,
  getZoneMapping,
  getRateCardStatistics
} from '../controllers/ratecard.controller.js';

const router = express.Router();

// All routes require seller authentication
router.use(authenticateSeller);

// Get available rate cards for seller
router.get('/', getSellerRateCard);

// Calculate shipping rate using unified rate card system
router.post('/calculate', validationHandler(calculateRateSchema), calculateShippingRate);

// Get rate comparison across multiple couriers
router.post('/compare', validationHandler(calculateRateSchema), getRateComparison);

// Get zone mapping for pincodes
router.get('/zones', getZoneMapping);

// Get rate card statistics for seller dashboard
router.get('/statistics', getRateCardStatistics);

export default router; 
