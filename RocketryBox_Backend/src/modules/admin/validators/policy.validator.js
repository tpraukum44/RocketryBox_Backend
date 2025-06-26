import { body, param, query } from 'express-validator';
import { validationHandler as validate } from '../../../middleware/validator.js';

// Validate policy creation
export const validateCreatePolicy = [
  body('title')
    .notEmpty()
    .withMessage('Policy title is required')
    .isString()
    .withMessage('Policy title must be a string')
    .trim(),
  
  body('slug')
    .optional()
    .isString()
    .withMessage('Policy slug must be a string')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Policy slug must contain only lowercase letters, numbers, and hyphens')
    .trim(),
  
  body('content')
    .notEmpty()
    .withMessage('Policy content is required')
    .isString()
    .withMessage('Policy content must be a string'),
  
  body('seoTitle')
    .optional()
    .isString()
    .withMessage('SEO title must be a string')
    .trim(),
  
  body('seoDescription')
    .optional()
    .isString()
    .withMessage('SEO description must be a string')
    .trim(),
  
  body('seoKeywords')
    .optional()
    .isString()
    .withMessage('SEO keywords must be a string')
    .trim(),
  
  body('status')
    .optional()
    .isIn(['draft', 'published'])
    .withMessage('Status must be either draft or published'),
  
  body('type')
    .optional()
    .isIn([
      'terms-of-service',
      'privacy-policy',
      'shipping-policy',
      'return-policy',
      'refund-policy',
      'cookie-policy',
      'user-agreement',
      'seller-agreement',
      'custom'
    ])
    .withMessage('Invalid policy type'),
  
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('Is default must be a boolean'),
  
  validate
];

// Validate policy update
export const validateUpdatePolicy = [
  param('slug')
    .notEmpty()
    .withMessage('Policy slug is required')
    .isString()
    .withMessage('Policy slug must be a string'),
  
  body('title')
    .optional()
    .isString()
    .withMessage('Policy title must be a string')
    .trim(),
  
  body('slug')
    .optional()
    .isString()
    .withMessage('Policy slug must be a string')
    .matches(/^[a-z0-9-]+$/)
    .withMessage('Policy slug must contain only lowercase letters, numbers, and hyphens')
    .trim(),
  
  body('content')
    .optional()
    .isString()
    .withMessage('Policy content must be a string'),
  
  body('seoTitle')
    .optional()
    .isString()
    .withMessage('SEO title must be a string')
    .trim(),
  
  body('seoDescription')
    .optional()
    .isString()
    .withMessage('SEO description must be a string')
    .trim(),
  
  body('seoKeywords')
    .optional()
    .isString()
    .withMessage('SEO keywords must be a string')
    .trim(),
  
  body('status')
    .optional()
    .isIn(['draft', 'published'])
    .withMessage('Status must be either draft or published'),
  
  body('type')
    .optional()
    .isIn([
      'terms-of-service',
      'privacy-policy',
      'shipping-policy',
      'return-policy',
      'refund-policy',
      'cookie-policy',
      'user-agreement',
      'seller-agreement',
      'custom'
    ])
    .withMessage('Invalid policy type'),
  
  body('isDefault')
    .optional()
    .isBoolean()
    .withMessage('Is default must be a boolean'),
  
  validate
];

// Validate policy get by slug
export const validateGetPolicy = [
  param('slug')
    .notEmpty()
    .withMessage('Policy slug is required')
    .isString()
    .withMessage('Policy slug must be a string'),
  
  validate
];

// Validate policy get by type
export const validateGetPolicyByType = [
  param('type')
    .notEmpty()
    .withMessage('Policy type is required')
    .isString()
    .withMessage('Policy type must be a string')
    .isIn([
      'terms-of-service',
      'privacy-policy',
      'shipping-policy',
      'return-policy',
      'refund-policy',
      'cookie-policy',
      'user-agreement',
      'seller-agreement'
    ])
    .withMessage('Invalid policy type'),
  
  validate
];

// Validate policy list
export const validateListPolicies = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('status')
    .optional()
    .isIn(['draft', 'published'])
    .withMessage('Status must be either draft or published'),
  
  query('type')
    .optional()
    .isIn([
      'terms-of-service',
      'privacy-policy',
      'shipping-policy',
      'return-policy',
      'refund-policy',
      'cookie-policy',
      'user-agreement',
      'seller-agreement',
      'custom'
    ])
    .withMessage('Invalid policy type'),
  
  validate
]; 