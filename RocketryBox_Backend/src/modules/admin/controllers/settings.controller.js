import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import Config from '../models/config.model.js';
import MaintenanceSettings from '../models/maintenance.model.js';

// Default system configuration
const DEFAULT_SYSTEM_CONFIG = {
  // General Settings
  siteTitle: 'RocketryBox',
  siteUrl: 'https://rocketrybox.com',
  adminEmail: 'admin@rocketrybox.com',
  supportPhone: '+1234567890',

  // Display Settings
  timezone: 'UTC',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24',
  weekStart: 'monday',
  showSeconds: false,

  // Currency Settings
  currency: 'INR',
  currencySymbol: '₹',
  currencyFormat: 'symbol',

  // Payment Settings
  enabledGateways: ['stripe', 'paypal', 'razorpay'],
  defaultGateway: 'razorpay',
  autoRefundEnabled: true,
  refundPeriod: 7,

  // Shipping Settings
  defaultCouriers: ['delhivery', 'ecom_express'],
  enabledCouriers: ['delhivery', 'ecom_express', 'blue_dart', 'ekart', 'xpressbees'],
  autoAssignCourier: true,
  defaultWeightUnit: 'kg',
  defaultDimensionUnit: 'cm',

  // Security Settings
  sessionTimeout: 60,
  loginAttempts: 5,
  passwordResetExpiry: 24,
  twoFactorAuth: false,

  // Maintenance Mode Settings
  maintenanceMode: false,
  maintenanceMessage: 'The system is currently undergoing maintenance. Please check back later.',
};

// Helper function to save/update system config
const saveSystemConfig = async (data, userId) => {
  // If a system config entry exists, update it
  const existingConfig = await Config.findOne({ key: 'system_config' });
  if (existingConfig) {
    // Add to history before updating
    existingConfig.history.push({
      value: existingConfig.value,
      updatedBy: userId,
      updatedAt: new Date()
    });

    existingConfig.value = data;
    existingConfig.updatedAt = new Date();
    return existingConfig.save();
  }

  // Otherwise create a new system config entry
  return Config.create({
    key: 'system_config',
    value: data,
    description: 'System configuration settings',
    category: 'System',
    type: 'Object',
    isSystemCritical: true,
    isHidden: false
  });
};

// Get system configuration
export const getSystemConfig = async (req, res, next) => {
  try {
    // Try to find existing system config
    const systemConfig = await Config.findOne({ key: 'system_config' });

    // If it doesn't exist, create default
    if (!systemConfig) {
      const newConfig = await saveSystemConfig(DEFAULT_SYSTEM_CONFIG);
      return res.status(200).json({
        success: true,
        data: newConfig.value
      });
    }

    // Return existing config
    res.status(200).json({
      success: true,
      data: systemConfig.value
    });
  } catch (error) {
    logger.error(`Error in getSystemConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update system configuration
export const updateSystemConfig = async (req, res, next) => {
  try {
    const updatedConfig = await saveSystemConfig(req.body, req.user.id);

    // Check if maintenance mode setting has changed
    if (req.body.maintenanceMode !== undefined) {
      // Update maintenance settings in the separate collection
      const maintenanceSettings = await MaintenanceSettings.getCurrentSettings();
      maintenanceSettings.isEnabled = req.body.maintenanceMode;

      if (req.body.maintenanceMessage) {
        maintenanceSettings.message = req.body.maintenanceMessage;
      }

      maintenanceSettings.updatedBy = req.user.id;
      await maintenanceSettings.save();

      logger.info(`Maintenance mode ${req.body.maintenanceMode ? 'enabled' : 'disabled'} via system settings by admin ${req.user.id}`);
    }

    res.status(200).json({
      success: true,
      data: updatedConfig.value,
      message: 'System configuration updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateSystemConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get configuration by category
export const getConfigByCategory = async (req, res, next) => {
  try {
    const { category } = req.params;

    const configItems = await Config.find({
      category,
      isHidden: false
    });

    // Format response
    const formattedConfig = configItems.reduce((acc, item) => {
      acc[item.key] = item.value;
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: formattedConfig
    });
  } catch (error) {
    logger.error(`Error in getConfigByCategory: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update configuration by key
export const updateConfigByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value } = req.body;

    const configItem = await Config.findOne({ key });

    if (!configItem) {
      return next(new AppError(`Configuration with key '${key}' not found`, 404));
    }

    // Add to history before updating
    configItem.history.push({
      value: configItem.value,
      updatedBy: req.user.id,
      updatedAt: new Date()
    });

    // Update value
    configItem.value = value;
    await configItem.save();

    res.status(200).json({
      success: true,
      data: configItem,
      message: `Configuration '${key}' updated successfully`
    });
  } catch (error) {
    logger.error(`Error in updateConfigByKey: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Reset system configuration to defaults
export const resetSystemConfig = async (req, res, next) => {
  try {
    const updatedConfig = await saveSystemConfig(DEFAULT_SYSTEM_CONFIG, req.user.id);

    // Also reset maintenance mode settings
    const maintenanceSettings = await MaintenanceSettings.getCurrentSettings();
    maintenanceSettings.isEnabled = DEFAULT_SYSTEM_CONFIG.maintenanceMode;
    maintenanceSettings.message = DEFAULT_SYSTEM_CONFIG.maintenanceMessage;
    maintenanceSettings.updatedBy = req.user.id;
    await maintenanceSettings.save();

    res.status(200).json({
      success: true,
      data: updatedConfig.value,
      message: 'System configuration reset to defaults successfully'
    });
  } catch (error) {
    logger.error(`Error in resetSystemConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};
