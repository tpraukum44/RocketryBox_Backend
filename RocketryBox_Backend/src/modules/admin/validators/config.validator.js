import { body, param } from 'express-validator';

export const configKeyValidator = [
  param('key')
    .notEmpty()
    .withMessage('Configuration key is required')
    .isString()
    .withMessage('Configuration key must be a string')
    .isLength({ min: 3, max: 50 })
    .withMessage('Configuration key must be between 3 and 50 characters')
];

export const createConfigValidator = [
  body('key')
    .notEmpty()
    .withMessage('Configuration key is required')
    .isString()
    .withMessage('Configuration key must be a string')
    .isLength({ min: 3, max: 50 })
    .withMessage('Configuration key must be between 3 and 50 characters'),
  body('value')
    .notEmpty()
    .withMessage('Configuration value is required'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  body('type')
    .optional()
    .isIn(['String', 'Number', 'Boolean', 'Object', 'Array'])
    .withMessage('Type must be one of: String, Number, Boolean, Object, Array'),
  body('isSystemCritical')
    .optional()
    .isBoolean()
    .withMessage('isSystemCritical must be a boolean')
];

export const updateConfigValidator = [
  ...configKeyValidator,
  body('value')
    .notEmpty()
    .withMessage('Configuration value is required'),
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string')
]; 