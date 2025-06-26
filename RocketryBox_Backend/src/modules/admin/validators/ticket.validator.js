import { body, param, query } from 'express-validator';
import mongoose from 'mongoose';
import { validationHandler as validate } from '../../../middleware/validator.js';

// Validate ticket creation
export const validateCreateTicket = [
  body('subject')
    .trim()
    .notEmpty().withMessage('Ticket subject is required')
    .isLength({ min: 5, max: 200 }).withMessage('Subject must be between 5 and 200 characters'),
  
  body('category')
    .trim()
    .notEmpty().withMessage('Ticket category is required')
    .isIn(['ORDER', 'PICKUP', 'BILLING', 'REMITTANCE', 'WT_DISPUTE', 'TECH', 'CALLBACK', 'KYC', 'FINANCE'])
    .withMessage('Invalid ticket category'),
  
  body('priority')
    .optional()
    .trim()
    .isIn(['Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Invalid priority level'),
  
  body('customerType')
    .trim()
    .notEmpty().withMessage('Customer type is required')
    .isIn(['seller', 'customer'])
    .withMessage('Customer type must be either seller or customer'),
  
  body('customerId')
    .trim()
    .notEmpty().withMessage('Customer ID is required')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid customer ID format');
      }
      return true;
    }),
  
  body('details')
    .trim()
    .notEmpty().withMessage('Ticket details are required')
    .isLength({ min: 10 }).withMessage('Ticket details must be at least 10 characters'),
  
  body('relatedEntities.order')
    .optional()
    .custom(value => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid order ID format');
      }
      return true;
    }),
  
  body('relatedEntities.orderModel')
    .optional()
    .isIn(['SellerOrder', 'CustomerOrder'])
    .withMessage('Invalid order model'),
  
  body('relatedEntities.shipment')
    .optional()
    .custom(value => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid shipment ID format');
      }
      return true;
    }),
  
  body('relatedEntities.shipmentModel')
    .optional()
    .isIn(['SellerShipment', 'AdminShipment'])
    .withMessage('Invalid shipment model'),

  validate
];

// Validate ticket status update
export const validateUpdateStatus = [
  param('id')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid ticket ID format');
      }
      return true;
    }),
  
  body('status')
    .trim()
    .notEmpty().withMessage('Status is required')
    .isIn(['New', 'In Progress', 'Resolved', 'Closed'])
    .withMessage('Invalid ticket status'),
  
  body('reason')
    .optional()
    .trim()
    .isLength({ min: 3, max: 500 }).withMessage('Reason must be between 3 and 500 characters'),
  
  validate
];

// Validate ticket assignment
export const validateAssignTicket = [
  param('id')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid ticket ID format');
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
  
  validate
];

// Validate ticket response
export const validateAddResponse = [
  param('id')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid ticket ID format');
      }
      return true;
    }),
  
  body('message')
    .trim()
    .notEmpty().withMessage('Response message is required')
    .isLength({ min: 2, max: 5000 }).withMessage('Message must be between 2 and 5000 characters'),
  
  validate
];

// Validate ticket list query parameters
export const validateListTickets = [
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
    .isIn(['New', 'In Progress', 'Resolved', 'Closed', ''])
    .withMessage('Invalid status'),
  
  query('category')
    .optional()
    .isIn(['ORDER', 'PICKUP', 'BILLING', 'REMITTANCE', 'WT_DISPUTE', 'TECH', 'CALLBACK', 'KYC', 'FINANCE', ''])
    .withMessage('Invalid category'),
  
  query('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Urgent', ''])
    .withMessage('Invalid priority'),
  
  query('customerType')
    .optional()
    .isIn(['seller', 'customer', ''])
    .withMessage('Customer type must be either seller or customer'),
  
  query('customerId')
    .optional()
    .custom(value => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid customer ID format');
      }
      return true;
    }),
  
  query('assignedTo')
    .optional()
    .custom(value => {
      if (value && !mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid admin ID format');
      }
      return true;
    }),
  
  query('from')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('to')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  query('sortField')
    .optional()
    .isIn(['createdAt', 'updatedAt', 'priority', 'status', 'category', ''])
    .withMessage('Invalid sort field'),
  
  query('sortOrder')
    .optional()
    .isIn(['asc', 'desc', ''])
    .withMessage('Sort order must be asc or desc'),
  
  validate
];

// Validate ticket export parameters
export const validateExportTickets = [
  query('format')
    .optional()
    .isIn(['csv', 'excel'])
    .withMessage('Format must be either csv or excel'),
  
  query('dateFrom')
    .optional()
    .isISO8601().withMessage('From date must be in ISO format (YYYY-MM-DD)'),
  
  query('dateTo')
    .optional()
    .isISO8601().withMessage('To date must be in ISO format (YYYY-MM-DD)'),
  
  query('status')
    .optional()
    .isIn(['New', 'In Progress', 'Resolved', 'Closed', ''])
    .withMessage('Invalid status'),
  
  query('category')
    .optional()
    .isIn(['ORDER', 'PICKUP', 'BILLING', 'REMITTANCE', 'WT_DISPUTE', 'TECH', 'CALLBACK', 'KYC', 'FINANCE', ''])
    .withMessage('Invalid category'),
  
  query('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Urgent', ''])
    .withMessage('Invalid priority'),
  
  validate
]; 