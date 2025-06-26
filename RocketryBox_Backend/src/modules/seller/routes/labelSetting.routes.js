import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import { updateLabelSettingSchema } from '../validators/labelSetting.validator.js';
import { getLabelSetting, updateLabelSetting } from '../controllers/labelSetting.controller.js';

const router = express.Router();

router.use(authenticateSeller);

// Get label settings
router.get('/label-settings', getLabelSetting);
// Update label settings
router.put('/label-settings', validationHandler(updateLabelSettingSchema), updateLabelSetting);

export default router; 
