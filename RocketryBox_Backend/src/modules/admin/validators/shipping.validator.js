import { body, query, param } from 'express-validator';
import { AppError } from '../../../middleware/errorHandler.js';
import { validationHandler } from '../../../middleware/validator.js';
import mongoose from 'mongoose';

// Validate get shipping charges request
export const validateGetShippingCharges = [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('sellerId').optional().custom(value => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('Invalid seller ID');
    }
    return true;
  }),
  query('courierName').optional().isString().withMessage('Courier name must be a string'),
  query('status').optional().isString().withMessage('Status must be a string'),
  query('from').optional().isDate().withMessage('From date must be a valid date'),
  query('to').optional().isDate().withMessage('To date must be a valid date'),
  query('orderNumber').optional().isString().withMessage('Order number must be a string'),
  query('airwaybillNumber').optional().isString().withMessage('Airway bill number must be a string'),
  query('format').optional().isIn(['csv', 'xlsx']).withMessage('Format must be csv or xlsx'),
  validationHandler
];

// Validate create shipping charge request
export const validateCreateShippingCharge = [
  body('sellerId')
    .notEmpty().withMessage('Seller ID is required')
    .custom(value => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid seller ID');
      }
      return true;
    }),
  body('sellerName').notEmpty().withMessage('Seller name is required'),
  body('courierName').notEmpty().withMessage('Courier name is required'),
  body('airwaybillNumber').notEmpty().withMessage('Airway bill number is required'),
  body('orderNumber').notEmpty().withMessage('Order number is required'),
  body('date').notEmpty().withMessage('Date is required').isDate().withMessage('Invalid date format'),
  body('shipmentType').notEmpty().withMessage('Shipment type is required'),
  body('originPincode').notEmpty().withMessage('Origin pincode is required'),
  body('destinationPincode').notEmpty().withMessage('Destination pincode is required'),
  body('bookedWeight').notEmpty().withMessage('Booked weight is required').isNumeric().withMessage('Booked weight must be a number'),
  body('chargeableAmount').notEmpty().withMessage('Chargeable amount is required').isNumeric().withMessage('Chargeable amount must be a number'),
  body('freightCharge').notEmpty().withMessage('Freight charge is required').isNumeric().withMessage('Freight charge must be a number'),
  body('codCharge').optional().isNumeric().withMessage('COD charge must be a number'),
  body('amountBeforeDiscount').notEmpty().withMessage('Amount before discount is required').isNumeric().withMessage('Amount before discount must be a number'),
  body('discount').optional().isNumeric().withMessage('Discount must be a number'),
  body('amountAfterDiscount').notEmpty().withMessage('Amount after discount is required').isNumeric().withMessage('Amount after discount must be a number'),
  body('status').optional().isString().withMessage('Status must be a string'),
  validationHandler
];

// Validate update shipping charge status request
export const validateUpdateShippingChargeStatus = [
  param('id').custom(value => {
    if (!mongoose.Types.ObjectId.isValid(value)) {
      throw new Error('Invalid shipping charge ID');
    }
    return true;
  }),
  body('status').notEmpty().withMessage('Status is required')
    .isIn(['in_transit', 'delivered', 'returned', 'cancelled'])
    .withMessage('Status must be one of: in_transit, delivered, returned, cancelled'),
  validationHandler
]; 