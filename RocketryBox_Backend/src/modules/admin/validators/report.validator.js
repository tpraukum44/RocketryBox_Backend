import { query } from 'express-validator';
import { validationHandler as validate } from '../../../middleware/validator.js';

// Validate report stats request
export const validateReportStats = [
  query('from')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('to')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  validate
];

// Validate revenue data request
export const validateRevenueData = [
  query('from')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('to')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  query('timeFilter')
    .optional()
    .isIn(['1D', '1W', '1M', '3M', '1Y', 'ALL'])
    .withMessage('Time filter must be one of: 1D, 1W, 1M, 3M, 1Y, ALL'),
  
  validate
];

// Validate shipment data request
export const validateShipmentData = [
  query('from')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('to')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  query('timeFilter')
    .optional()
    .isIn(['1D', '1W', '1M', '3M', '1Y', 'ALL'])
    .withMessage('Time filter must be one of: 1D, 1W, 1M, 3M, 1Y, ALL'),
  
  query('courier')
    .optional()
    .isString().withMessage('Courier must be a string'),
  
  query('status')
    .optional()
    .isString().withMessage('Status must be a string'),
  
  validate
];

// Validate customer data request
export const validateCustomerData = [
  query('from')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('to')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  query('timeFilter')
    .optional()
    .isIn(['1D', '1W', '1M', '3M', '1Y', 'ALL'])
    .withMessage('Time filter must be one of: 1D, 1W, 1M, 3M, 1Y, ALL'),
  
  validate
];

// Validate dashboard KPI request
export const validateDashboardKPI = [
  query('from')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('to')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  validate
];

// Validate export report request
export const validateExportReport = [
  query('type')
    .notEmpty().withMessage('Report type is required')
    .isIn(['seller', 'customer']).withMessage('Report type must be either "seller" or "customer"'),
  
  query('format')
    .optional()
    .isIn(['csv', 'excel']).withMessage('Format must be either "csv" or "excel"'),
  
  query('from')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('to')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  validate
]; 