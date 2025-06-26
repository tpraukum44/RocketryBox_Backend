import express from 'express';
import { adminOnly } from '../../../middleware/admin.js';
import { validationHandler } from '../../../middleware/validator.js';
import {
  createCODRemittance,
  getCODRemittanceDetails,
  getCODSummary,
  listCODRemittances,
  updateCODRemittance
} from '../controllers/codRemittance.controller.js';
import {
  createCODRemittanceSchema,
  updateCODRemittanceSchema
} from '../validators/codRemittance.validator.js';

const router = express.Router();

// Seller routes - Clean paths to match frontend expectations
router.get('/summary', getCODSummary);
router.get('/remittance-history', listCODRemittances);
router.get('/remittances/:id', getCODRemittanceDetails);

// For export/download functionality (matches frontend ServiceFactory)
router.get('/export', async (req, res, next) => {
  try {
    // This is a placeholder for the download functionality
    // The frontend expects this endpoint for downloading remittances
    res.status(501).json({
      success: false,
      message: 'Export functionality not yet implemented'
    });
  } catch (error) {
    next(error);
  }
});

// Admin routes
router.use('/admin', adminOnly);
router.post('/admin/remittances', validationHandler(createCODRemittanceSchema), createCODRemittance);
router.patch('/admin/remittances/:id', validationHandler(updateCODRemittanceSchema), updateCODRemittance);

export default router;
