import { body, param } from 'express-validator';
import { validationHandler as validate } from '../../../middleware/validator.js';

// Validate maintenance settings update
export const validateMaintenanceSettings = [
  body('isEnabled')
    .optional()
    .isBoolean()
    .withMessage('isEnabled must be a boolean'),
  
  body('startTime')
    .optional()
    .isISO8601()
    .withMessage('startTime must be a valid date in ISO format')
    .custom((value, { req }) => {
      if (value && req.body.endTime && new Date(value) >= new Date(req.body.endTime)) {
        throw new Error('startTime must be before endTime');
      }
      return true;
    }),
  
  body('endTime')
    .optional()
    .isISO8601()
    .withMessage('endTime must be a valid date in ISO format')
    .custom((value, { req }) => {
      const now = new Date();
      const endTime = new Date(value);
      
      if (endTime <= now) {
        throw new Error('endTime must be in the future');
      }
      
      return true;
    }),
  
  body('message')
    .optional()
    .isString()
    .withMessage('message must be a string')
    .trim(),
  
  body('allowAdminAccess')
    .optional()
    .isBoolean()
    .withMessage('allowAdminAccess must be a boolean'),
  
  validate
];

// Validate add IP to whitelist
export const validateAddWhitelistedIP = [
  body('ip')
    .notEmpty()
    .withMessage('IP address is required')
    .isString()
    .withMessage('IP address must be a string')
    .matches(/^(\d{1,3}\.){3}\d{1,3}(\/\d{1,2})?$/)
    .withMessage('Invalid IP address format (should be like 192.168.1.1 or 192.168.1.1/24)')
    .trim(),
  
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
    .trim(),
  
  validate
];

// Validate remove IP from whitelist
export const validateRemoveWhitelistedIP = [
  param('ip')
    .notEmpty()
    .withMessage('IP address is required')
    .isString()
    .withMessage('IP address must be a string')
    .trim(),
  
  validate
]; 