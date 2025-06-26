import express from 'express';
import {
  getMaintenanceSettings,
  updateMaintenanceSettings,
  addWhitelistedIP,
  removeWhitelistedIP,
  getMaintenanceStatus
} from '../controllers/maintenance.controller.js';
import {
  validateMaintenanceSettings,
  validateAddWhitelistedIP,
  validateRemoveWhitelistedIP
} from '../validators/maintenance.validator.js';
import { protect } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';

const router = express.Router();

// Get maintenance settings
router.get(
  '/',
  protect,
  checkPermission('settings'),
  getMaintenanceSettings
);

// Update maintenance settings
router.put(
  '/',
  protect,
  checkPermission('settings'),
  validateMaintenanceSettings,
  updateMaintenanceSettings
);

// Get maintenance status (public endpoint)
router.get(
  '/status',
  getMaintenanceStatus
);

// Add IP to whitelist
router.post(
  '/whitelist',
  protect,
  checkPermission('settings'),
  validateAddWhitelistedIP,
  addWhitelistedIP
);

// Remove IP from whitelist
router.delete(
  '/whitelist/:ip',
  protect,
  checkPermission('settings'),
  validateRemoveWhitelistedIP,
  removeWhitelistedIP
);

export default router; 