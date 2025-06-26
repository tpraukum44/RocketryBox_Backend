import express from 'express';
import { protect, restrictTo } from '../../../middleware/auth.js';
import { defaultLimiter } from '../../../middleware/rateLimiter.js';
import { validationHandler as validate } from '../../../middleware/validator.js';
import * as partnerController from '../controllers/shippingPartner.controller.js';
import { 
  createShippingPartnerSchema, 
  updateShippingPartnerSchema,
  updatePartnerStatusSchema, 
  updatePartnerPerformanceSchema,
  updatePartnerRatesSchema 
} from '../validators/shippingPartner.validator.js';

const router = express.Router();

// Protect all routes
router.use(protect);
router.use(restrictTo('Admin', 'Manager'));

// Apply rate limiter to some routes
const rateRestrictedRoutes = [
  router.post('/', defaultLimiter),
  router.put('/:id', defaultLimiter),
  router.delete('/:id', defaultLimiter)
];

// Get shipping partners with filtering and pagination
router.get('/', partnerController.getShippingPartners);

// Export shipping partners data
router.get('/export', partnerController.exportPartners);

// Get single shipping partner by ID
router.get('/:id', partnerController.getShippingPartnerById);

// Create new shipping partner
router.post('/', validate(createShippingPartnerSchema), partnerController.createShippingPartner);

// Update shipping partner
router.put('/:id', validate(updateShippingPartnerSchema), partnerController.updateShippingPartner);

// Update shipping partner status
router.patch('/:id/status', validate(updatePartnerStatusSchema), partnerController.updatePartnerStatus);

// Delete shipping partner (superAdmin only)
router.delete('/:id', partnerController.deleteShippingPartner);

// Get partner performance metrics
router.get('/:id/performance', partnerController.getPartnerPerformance);

// Update partner performance metrics
router.post('/:id/performance', validate(updatePartnerPerformanceSchema), partnerController.updatePartnerPerformance);

// Get partner rate cards
router.get('/:id/rates', partnerController.getPartnerRates);

// Update partner rate cards
router.put('/:id/rates', validate(updatePartnerRatesSchema), partnerController.updatePartnerRates);

export default router; 