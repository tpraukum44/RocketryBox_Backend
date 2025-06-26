import express from 'express';
import { getAPISettings, generateNewCredentials, updateAPIStatus } from '../controllers/apiSettings.controller.js';
import { validationHandler } from '../../../middleware/validator.js';
import { updateAPIStatusSchema } from '../validators/apiSettings.validator.js';
import { authenticateSeller } from '../../../middleware/auth.js';

const router = express.Router();

// Get current API settings
router.get('/', authenticateSeller, getAPISettings);

// Generate new API credentials
router.post('/generate', authenticateSeller, generateNewCredentials);

// Enable/disable API access
router.patch('/status', authenticateSeller, validationHandler(updateAPIStatusSchema), updateAPIStatus);

export default router; 
