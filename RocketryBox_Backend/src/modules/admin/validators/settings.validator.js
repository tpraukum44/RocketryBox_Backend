import { body, param } from 'express-validator';
import { validationHandler as validate } from '../../../middleware/validator.js';

// Validate system config update
export const validateSystemConfig = [
  // General Settings
  body('siteTitle')
    .optional()
    .isString()
    .withMessage('Site title must be a string')
    .trim(),
  
  body('siteUrl')
    .optional()
    .isURL()
    .withMessage('Site URL must be a valid URL')
    .trim(),
  
  body('adminEmail')
    .optional()
    .isEmail()
    .withMessage('Admin email must be a valid email address')
    .trim(),
  
  body('supportPhone')
    .optional()
    .isString()
    .withMessage('Support phone must be a string')
    .trim(),
  
  // Display Settings
  body('timezone')
    .optional()
    .isString()
    .withMessage('Timezone must be a string')
    .trim(),
  
  body('dateFormat')
    .optional()
    .isIn(['DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'])
    .withMessage('Date format must be one of: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD'),
  
  body('timeFormat')
    .optional()
    .isIn(['12', '24'])
    .withMessage('Time format must be either 12 or 24'),
  
  body('weekStart')
    .optional()
    .isIn(['sunday', 'monday'])
    .withMessage('Week start must be either sunday or monday'),
  
  body('showSeconds')
    .optional()
    .isBoolean()
    .withMessage('Show seconds must be a boolean'),
  
  // Currency Settings
  body('currency')
    .optional()
    .isString()
    .withMessage('Currency must be a string')
    .trim(),
  
  body('currencySymbol')
    .optional()
    .isString()
    .withMessage('Currency symbol must be a string')
    .trim(),
  
  body('currencyFormat')
    .optional()
    .isIn(['both', 'symbol', 'text'])
    .withMessage('Currency format must be one of: both, symbol, text'),
  
  // Payment Settings
  body('enabledGateways')
    .optional()
    .isArray()
    .withMessage('Enabled gateways must be an array'),
  
  body('enabledGateways.*')
    .isString()
    .withMessage('Each gateway must be a string'),
  
  body('defaultGateway')
    .optional()
    .isString()
    .withMessage('Default gateway must be a string')
    .trim(),
  
  body('autoRefundEnabled')
    .optional()
    .isBoolean()
    .withMessage('Auto refund enabled must be a boolean'),
  
  body('refundPeriod')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Refund period must be a positive integer'),
  
  // Shipping Settings
  body('defaultCouriers')
    .optional()
    .isArray()
    .withMessage('Default couriers must be an array'),
  
  body('defaultCouriers.*')
    .isString()
    .withMessage('Each courier must be a string'),
  
  body('enabledCouriers')
    .optional()
    .isArray()
    .withMessage('Enabled couriers must be an array'),
  
  body('enabledCouriers.*')
    .isString()
    .withMessage('Each courier must be a string'),
  
  body('autoAssignCourier')
    .optional()
    .isBoolean()
    .withMessage('Auto assign courier must be a boolean'),
  
  body('defaultWeightUnit')
    .optional()
    .isIn(['kg', 'g', 'lb'])
    .withMessage('Default weight unit must be one of: kg, g, lb'),
  
  body('defaultDimensionUnit')
    .optional()
    .isIn(['cm', 'inch'])
    .withMessage('Default dimension unit must be one of: cm, inch'),
  
  // Security Settings
  body('sessionTimeout')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Session timeout must be a positive integer'),
  
  body('loginAttempts')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Login attempts must be a positive integer'),
  
  body('passwordResetExpiry')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Password reset expiry must be a positive integer'),
  
  body('twoFactorAuth')
    .optional()
    .isBoolean()
    .withMessage('Two factor auth must be a boolean'),
  
  // Maintenance Mode Settings
  body('maintenanceMode')
    .optional()
    .isBoolean()
    .withMessage('Maintenance mode must be a boolean'),
  
  body('maintenanceMessage')
    .optional()
    .isString()
    .withMessage('Maintenance message must be a string')
    .trim(),
  
  validate
];

// Validate config update by key
export const validateConfigByKey = [
  param('key')
    .notEmpty()
    .withMessage('Configuration key is required')
    .isString()
    .withMessage('Configuration key must be a string'),
  
  body('value')
    .notEmpty()
    .withMessage('Configuration value is required'),
  
  validate
]; 