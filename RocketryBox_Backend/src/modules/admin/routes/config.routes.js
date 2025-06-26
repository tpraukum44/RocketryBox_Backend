import express from 'express';
import { validationHandler as validate } from '../../../middleware/validator.js';
import { protect, restrictTo } from '../../../middleware/auth.js';
import * as configController from '../controllers/config.controller.js';
import * as configValidator from '../validators/config.validator.js';

const router = express.Router();

// All config routes are protected and restricted to Admin
router.use(protect);
router.use(restrictTo('Admin'));

// Get all configurations
router.get('/', configController.getAllConfigs);

// Create a new configuration
router.post(
  '/',
  validate(configValidator.createConfigValidator),
  configController.createConfig
);

// Get, update, or delete a specific configuration
router.get(
  '/:key',
  validate(configValidator.configKeyValidator),
  configController.getConfigByKey
);

router.patch(
  '/:key',
  validate(configValidator.updateConfigValidator),
  configController.updateConfig
);

router.delete(
  '/:key',
  validate(configValidator.configKeyValidator),
  configController.deleteConfig
);

// Get configuration history
router.get(
  '/:key/history',
  validate(configValidator.configKeyValidator),
  configController.getConfigHistory
);

export default router; 