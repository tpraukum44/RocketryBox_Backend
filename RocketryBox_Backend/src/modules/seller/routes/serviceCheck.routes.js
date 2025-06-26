import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import { bulkServiceCheckSchema, getServiceRestrictionsSchema } from '../validators/serviceCheck.validator.js';
import { bulkServiceCheck, getServiceRestrictions } from '../controllers/serviceCheck.controller.js';

const router = express.Router();

router.use(authenticateSeller);

// Bulk pincode service check
router.post('/pincode', validationHandler(bulkServiceCheckSchema), bulkServiceCheck);
// Get service restrictions
router.get('/restrictions', validationHandler(getServiceRestrictionsSchema, 'query'), getServiceRestrictions);

export default router; 
