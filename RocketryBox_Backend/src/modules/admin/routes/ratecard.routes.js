import express from 'express';
import multer from 'multer';
import { protect, restrictTo } from '../../../middleware/auth.js';
import * as rateCardController from '../controllers/ratecard.controller.js';
import { validateCreateRateCards } from '../validators/billing.validator.js';

const router = express.Router();

// Configure multer for Excel file uploads
const storage = multer.memoryStorage(); // Store in memory for processing
const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 1 // Only one file at a time
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel' // .xls
    ];

    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Please upload a valid Excel file (.xlsx or .xls)'), false);
    }
  }
});

// All rate card routes are protected for admins
router.use(protect);
router.use(restrictTo('Admin', 'Manager'));

// Excel upload and template routes (must come before parameterized routes)
router.post('/upload', upload.single('file'), rateCardController.uploadRateCardsExcel);
router.get('/template', rateCardController.downloadRateCardTemplate);

// Statistics and utility routes (must come before parameterized routes)
router.get('/statistics', rateCardController.getRateCardStatistics);
router.get('/couriers', rateCardController.getActiveCouriers);

// Import route (SuperAdmin only)
router.post('/import', restrictTo('Admin'), rateCardController.importRateCards);

// CRUD routes
router.route('/')
  .get(rateCardController.getAllRateCards)
  .post(validateCreateRateCards, rateCardController.createRateCards);

router.route('/:id')
  .get(rateCardController.getRateCardById)
  .patch(rateCardController.updateRateCard)
  .delete(restrictTo('Admin'), rateCardController.deleteRateCard);

// Deactivate route
router.patch('/:id/deactivate', rateCardController.deactivateRateCard);

export default router;
