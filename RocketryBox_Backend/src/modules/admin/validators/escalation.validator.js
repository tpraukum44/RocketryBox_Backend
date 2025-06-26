import { body, param, query } from 'express-validator';
import { validationHandler as validate } from '../../../middleware/validator.js';

// Validate query parameters for escalation search
export const validateSearchEscalations = [
  query('type')
    .optional()
    .isIn(['pickup', 'shipment', 'billing', 'weight', 'tech'])
    .withMessage('Type must be one of: pickup, shipment, billing, weight, tech'),
  
  query('status')
    .optional()
    .isIn(['Pending', 'In Progress', 'Resolved', 'Closed', 'Re-opened'])
    .withMessage('Status must be one of: Pending, In Progress, Resolved, Closed, Re-opened'),
  
  query('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Priority must be one of: Low, Medium, High, Urgent'),
  
  query('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  
  query('sellerId')
    .optional()
    .isMongoId()
    .withMessage('Seller ID must be a valid MongoDB ObjectId'),
  
  query('customerId')
    .optional()
    .isMongoId()
    .withMessage('Customer ID must be a valid MongoDB ObjectId'),
  
  query('assignedTo')
    .optional()
    .isMongoId()
    .withMessage('Assigned to ID must be a valid MongoDB ObjectId'),
  
  query('fromDate')
    .optional()
    .isISO8601()
    .withMessage('From date must be in ISO8601 format'),
  
  query('toDate')
    .optional()
    .isISO8601()
    .withMessage('To date must be in ISO8601 format'),
  
  query('isUrgent')
    .optional()
    .isBoolean()
    .withMessage('isUrgent must be a boolean value'),
  
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be a positive integer between 1 and 100'),
  
  validate
];

// Validate escalation type in query
export const validateEscalationType = [
  query('type')
    .notEmpty()
    .withMessage('Escalation type is required')
    .isIn(['pickup', 'shipment', 'billing', 'weight', 'tech'])
    .withMessage('Type must be one of: pickup, shipment, billing, weight, tech'),
  
  validate
];

// Validate escalation ID in params
export const validateEscalationId = [
  param('id')
    .notEmpty()
    .withMessage('Escalation ID is required')
    .isMongoId()
    .withMessage('Escalation ID must be a valid MongoDB ObjectId'),
  
  validate
];

// Validate create escalation request
export const validateCreateEscalation = [
  // Common fields validation
  body('referenceId')
    .notEmpty()
    .withMessage('Reference ID is required')
    .isString()
    .withMessage('Reference ID must be a string'),
  
  body('description')
    .notEmpty()
    .withMessage('Description is required')
    .isString()
    .withMessage('Description must be a string'),
  
  body('status')
    .optional()
    .isIn(['Pending', 'In Progress', 'Resolved', 'Closed', 'Re-opened'])
    .withMessage('Status must be one of: Pending, In Progress, Resolved, Closed, Re-opened'),
  
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Priority must be one of: Low, Medium, High, Urgent'),
  
  body('category')
    .notEmpty()
    .withMessage('Category is required')
    .isString()
    .withMessage('Category must be a string'),
  
  body('seller')
    .optional(),
  
  body('seller.id')
    .optional()
    .isMongoId()
    .withMessage('Seller ID must be a valid MongoDB ObjectId'),
  
  body('customer')
    .optional(),
  
  body('customer.id')
    .optional()
    .isMongoId()
    .withMessage('Customer ID must be a valid MongoDB ObjectId'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be in ISO8601 format'),
  
  body('isUrgent')
    .optional()
    .isBoolean()
    .withMessage('isUrgent must be a boolean value'),
  
  // Custom validation based on escalation type
  (req, res, next) => {
    const type = req.query.type?.toLowerCase();
    
    if (!type) {
      return next();
    }
    
    // Additional type-specific validations can be added here
    switch(type) {
      case 'pickup':
        body('pickup.pickupId')
          .notEmpty()
          .withMessage('Pickup ID is required for pickup escalations');
        break;
        
      case 'shipment':
        body('shipment.orderId')
          .notEmpty()
          .withMessage('Order ID is required for shipment escalations');
        break;
        
      case 'billing':
        body('billing.remittanceId')
          .notEmpty()
          .withMessage('Remittance ID is required for billing escalations');
        break;
    }
    
    next();
  },
  
  validate
];

// Validate update escalation request
export const validateUpdateEscalation = [
  body('status')
    .optional()
    .isIn(['Pending', 'In Progress', 'Resolved', 'Closed', 'Re-opened'])
    .withMessage('Status must be one of: Pending, In Progress, Resolved, Closed, Re-opened'),
  
  body('priority')
    .optional()
    .isIn(['Low', 'Medium', 'High', 'Urgent'])
    .withMessage('Priority must be one of: Low, Medium, High, Urgent'),
  
  body('description')
    .optional()
    .isString()
    .withMessage('Description must be a string'),
  
  body('category')
    .optional()
    .isString()
    .withMessage('Category must be a string'),
  
  body('dueDate')
    .optional()
    .isISO8601()
    .withMessage('Due date must be in ISO8601 format'),
  
  body('isUrgent')
    .optional()
    .isBoolean()
    .withMessage('isUrgent must be a boolean value'),
  
  body('statusRemarks')
    .optional()
    .isString()
    .withMessage('Status remarks must be a string'),
  
  validate
];

// Validate add comment request
export const validateAddComment = [
  param('id')
    .notEmpty()
    .withMessage('Escalation ID is required')
    .isMongoId()
    .withMessage('Escalation ID must be a valid MongoDB ObjectId'),
  
  query('type')
    .notEmpty()
    .withMessage('Escalation type is required')
    .isIn(['pickup', 'shipment', 'billing', 'weight', 'tech'])
    .withMessage('Type must be one of: pickup, shipment, billing, weight, tech'),
  
  body('comment')
    .notEmpty()
    .withMessage('Comment is required')
    .isString()
    .withMessage('Comment must be a string'),
  
  validate
];

// Validate assign escalation request
export const validateAssignEscalation = [
  param('id')
    .notEmpty()
    .withMessage('Escalation ID is required')
    .isMongoId()
    .withMessage('Escalation ID must be a valid MongoDB ObjectId'),
  
  query('type')
    .notEmpty()
    .withMessage('Escalation type is required')
    .isIn(['pickup', 'shipment', 'billing', 'weight', 'tech'])
    .withMessage('Type must be one of: pickup, shipment, billing, weight, tech'),
  
  body('adminId')
    .notEmpty()
    .withMessage('Admin ID is required')
    .isMongoId()
    .withMessage('Admin ID must be a valid MongoDB ObjectId'),
  
  body('adminName')
    .notEmpty()
    .withMessage('Admin name is required')
    .isString()
    .withMessage('Admin name must be a string'),
  
  body('adminRole')
    .optional()
    .isString()
    .withMessage('Admin role must be a string'),
  
  validate
];

// Validate bulk update request
export const validateBulkUpdate = [
  body('ids')
    .isArray({ min: 1 })
    .withMessage('At least one escalation ID is required'),
  
  body('ids.*')
    .isMongoId()
    .withMessage('All IDs must be valid MongoDB ObjectIds'),
  
  body('type')
    .notEmpty()
    .withMessage('Escalation type is required')
    .isIn(['pickup', 'shipment', 'billing', 'weight', 'tech'])
    .withMessage('Type must be one of: pickup, shipment, billing, weight, tech'),
  
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['Pending', 'In Progress', 'Resolved', 'Closed', 'Re-opened'])
    .withMessage('Status must be one of: Pending, In Progress, Resolved, Closed, Re-opened'),
  
  body('remarks')
    .optional()
    .isString()
    .withMessage('Remarks must be a string'),
  
  validate
];