import express from 'express';
import { getWhatsAppSettings, updateWhatsAppSettings, setWhatsAppEnabled } from '../controllers/whatsappSettings.controller.js';
import { validationHandler } from '../../../middleware/validator.js';
import { updateWhatsAppSettingsSchema, enableWhatsAppSettingsSchema } from '../validators/whatsappSettings.validator.js';
import { authenticateSeller } from '../../../middleware/auth.js';

const router = express.Router();

// Get WhatsApp settings
router.get('/', authenticateSeller, getWhatsAppSettings);

// Update WhatsApp settings
router.put('/', authenticateSeller, validationHandler(updateWhatsAppSettingsSchema), updateWhatsAppSettings);

// Enable/disable WhatsApp notifications
router.patch('/enable', authenticateSeller, validationHandler(enableWhatsAppSettingsSchema), setWhatsAppEnabled);

export default router; 
