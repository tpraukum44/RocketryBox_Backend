import express from 'express';
import { param, query } from 'express-validator';
import { checkAdminPermission } from '../../../middleware/adminPermission.js';
import { protect, restrictTo } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validator.js';
import * as shipmentController from '../controllers/shipment.controller.js';

const router = express.Router();

// TEMPORARY: Test route without auth for immediate functionality
router.get('/test-no-auth', shipmentController.getShipments);

// All shipment routes are protected and restricted to Admin/Manager
router.use(protect);
router.use(restrictTo('Admin', 'Manager'));

// Validation middleware
const shipmentIdValidator = [
  param('id')
    .isMongoId()
    .withMessage('Invalid shipment ID format')
];

const shipmentQueryValidator = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('awb')
    .optional()
    .isString()
    .trim()
    .withMessage('AWB must be a string'),
  query('courier')
    .optional()
    .isString()
    .trim()
    .withMessage('Courier must be a string'),
  query('status')
    .optional()
    .isString()
    .trim()
    .withMessage('Status must be a string'),
  query('sellerId')
    .optional()
    .isMongoId()
    .withMessage('Invalid seller ID format'),
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
];

// Get all shipments - requires ordersShipping permission
router.get('/', checkAdminPermission('ordersShipping'), shipmentQueryValidator, validate, shipmentController.getShipments);

// Get shipment details by ID - requires ordersShipping permission
router.get('/:id', checkAdminPermission('ordersShipping'), shipmentIdValidator, validate, shipmentController.getShipmentById);

// Sync shipments from seller data - requires ordersShipping permission
router.post('/sync', checkAdminPermission('ordersShipping'), shipmentController.syncShipments);

export default router;
