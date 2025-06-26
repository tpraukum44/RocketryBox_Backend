import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import { courierSettingSchema } from '../validators/courierSetting.validator.js';
import { listCourierSettings, addOrUpdateCourierSetting, getCourierSetting, deleteCourierSetting } from '../controllers/courierSetting.controller.js';

const router = express.Router();

router.use(authenticateSeller);

// List courier settings
router.get('/courier-settings', listCourierSettings);
// Add or update courier setting
router.post('/courier-settings', validationHandler(courierSettingSchema), addOrUpdateCourierSetting);
// Get courier setting details
router.get('/courier-settings/:id', getCourierSetting);
// Delete courier setting
router.delete('/courier-settings/:id', deleteCourierSetting);

export default router; 
