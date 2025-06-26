import express from 'express';
import rateCardRoutes from './routes/ratecard.routes.js';

const router = express.Router();

/**
 * Shipping Module Routes
 * Base path: /api/v2/shipping
 */

// Rate card routes
router.use('/ratecards', rateCardRoutes);

export default router; 