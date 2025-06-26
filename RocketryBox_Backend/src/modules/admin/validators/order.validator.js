import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';

// Order query validation for getAllOrders
export const orderQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('search')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Search term must be a non-empty string'),
  query('status')
    .optional()
    .isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'])
    .withMessage('Status must be a valid order status'),
  query('sellerId')
    .optional()
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid seller ID format');
      }
      return true;
    })
    .withMessage('Valid seller ID is required'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date'),
  query('sortBy')
    .optional()
    .isIn(['createdAt', 'orderValue', 'status', 'deliveryDate'])
    .withMessage('Sort by must be a valid field'),
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc'])
    .withMessage('Sort order must be asc or desc')
];

// Order ID validation
export const orderIdValidator = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid order ID format');
      }
      return true;
    })
    .withMessage('Valid order ID is required')
];

// Update order status validation
export const updateOrderStatusValidator = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid order ID format');
      }
      return true;
    })
    .withMessage('Valid order ID is required'),
  body('status')
    .isIn(['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'returned'])
    .withMessage('Status must be a valid order status'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Reason must be a non-empty string if provided'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .withMessage('Notes must be a string if provided')
];

// Cancel order validation
export const cancelOrderValidator = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid order ID format');
      }
      return true;
    })
    .withMessage('Valid order ID is required'),
  body('reason')
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Cancellation reason is required'),
  body('refundAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Refund amount must be a positive number'),
  body('notes')
    .optional()
    .isString()
    .trim()
    .withMessage('Notes must be a string if provided')
];
