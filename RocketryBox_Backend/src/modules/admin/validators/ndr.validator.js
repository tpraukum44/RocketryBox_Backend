import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import { validationHandler as validate } from '../../../middleware/validator.js';

export const validateListNDRs = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('Page must be a positive integer')
    .toInt(),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
    .toInt(),
  
  query('status')
    .optional()
    .isIn(['Pending', 'In Progress', 'Resolved', 'RTO Initiated', 'RTO Completed', ''])
    .withMessage('Invalid status'),
  
  query('reasonCategory')
    .optional()
    .isIn(['Customer Not Available', 'Address Issues', 'Delivery Issues', 'Customer Refusal', ''])
    .withMessage('Invalid reason category'),
  
  query('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Urgent', ''])
    .withMessage('Invalid priority'),
  
  query('from')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('to')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  query('sortField')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'priority', 'status', 'attempts', ''])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc', ''])
    .withMessage('Sort order must be asc or desc'),
  
  validate
];

export const validateSyncNDRs = [
  body('fromDate')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  body('sellerId')
    .optional()
    .custom(value => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid seller ID format');
      }
      return true;
    }),
  
  validate
];

export const validateUpdateStatus = [
  param('id')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid NDR ID format');
      }
      return true;
    }),
  
  body('status')
    .trim()
    .notEmpty().withMessage('Status is required')
    .isIn(['Pending', 'In Progress', 'Resolved', 'RTO Initiated', 'RTO Completed'])
    .withMessage('Invalid NDR status'),
  
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 3, max: 500 }).withMessage('Reason must be between 3 and 500 characters'),
  
  body('agentRemarks')
    .optional()
    .trim()
    .isLength({ min: 3, max: 500 }).withMessage('Agent remarks must be between 3 and 500 characters'),
  
  validate
];

export const validateAssignNDR = [
  param('id')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid NDR ID format');
      }
      return true;
    }),
  
  body('assignedTo')
    .trim()
    .notEmpty().withMessage('Admin ID is required')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid admin ID format');
      }
      return true;
    }),
  
  body('comments')
    .optional()
    .trim()
    .isLength({ min: 3, max: 500 }).withMessage('Comments must be between 3 and 500 characters'),
  
  validate
];

export const validateInitiateRTO = [
  param('id')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid NDR ID format');
      }
      return true;
    }),
  
  body('reason')
    .trim()
    .notEmpty().withMessage('Reason is required')
    .isLength({ min: 3, max: 500 }).withMessage('Reason must be between 3 and 500 characters'),
  
  body('remarks')
    .optional()
    .trim()
    .isLength({ min: 3, max: 500 }).withMessage('Remarks must be between 3 and 500 characters'),
  
  validate
]; 