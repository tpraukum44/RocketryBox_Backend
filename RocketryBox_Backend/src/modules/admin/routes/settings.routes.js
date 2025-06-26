import express from 'express';
import {
  getSystemConfig,
  updateSystemConfig,
  getConfigByCategory,
  updateConfigByKey,
  resetSystemConfig
} from '../controllers/settings.controller.js';
import {
  validateSystemConfig,
  validateConfigByKey
} from '../validators/settings.validator.js';
import { protect } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';

const router = express.Router();

// System settings routes
router.get(
  '/system',
  protect,
  checkPermission('settings'),
  getSystemConfig
);

router.put(
  '/system',
  protect,
  checkPermission('settings'),
  validateSystemConfig,
  updateSystemConfig
);

router.post(
  '/system/reset',
  protect,
  checkPermission('settings'),
  resetSystemConfig
);

// Category-based settings
router.get(
  '/category/:category',
  protect,
  checkPermission('settings'),
  getConfigByCategory
);

// Key-based settings
router.put(
  '/key/:key',
  protect,
  checkPermission('settings'),
  validateConfigByKey,
  updateConfigByKey
);

export default router; 