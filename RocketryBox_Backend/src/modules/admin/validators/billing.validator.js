import { body, param, query } from 'express-validator';
import { validationHandler as validate } from '../../../middleware/validator.js';
import mongoose from 'mongoose';

// Wallet Transaction Validators
export const validateGetWalletTransactions = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('from')
    .optional()
    .isDate()
    .withMessage('From date must be a valid date'),
  
  query('to')
    .optional()
    .isDate()
    .withMessage('To date must be a valid date'),
  
  query('type')
    .optional()
    .isIn(['Recharge', 'Debit', 'COD Credit', 'Refund'])
    .withMessage('Type must be one of: Recharge, Debit, COD Credit, Refund'),
  
  validate
];

export const validateAddWalletTransaction = [
  body('sellerId')
    .notEmpty()
    .withMessage('Seller ID is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid seller ID format'),
  
  body('referenceNumber')
    .notEmpty()
    .withMessage('Reference number is required')
    .isString()
    .withMessage('Reference number must be a string'),
  
  body('type')
    .notEmpty()
    .withMessage('Transaction type is required')
    .isIn(['Recharge', 'Debit', 'COD Credit', 'Refund'])
    .withMessage('Type must be one of: Recharge, Debit, COD Credit, Refund'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  
  body('codCharge')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('COD charge must be a positive number'),
  
  body('igst')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('IGST must be a positive number'),
  
  validate
];

// Invoice Validators
export const validateGetInvoices = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  query('from')
    .optional()
    .isDate()
    .withMessage('From date must be a valid date'),
  
  query('to')
    .optional()
    .isDate()
    .withMessage('To date must be a valid date'),
  
  query('status')
    .optional()
    .isIn(['paid', 'due', 'cancelled'])
    .withMessage('Status must be one of: paid, due, cancelled'),
  
  validate
];

export const validateCreateInvoice = [
  body('sellerId')
    .notEmpty()
    .withMessage('Seller ID is required')
    .custom(value => mongoose.Types.ObjectId.isValid(value))
    .withMessage('Invalid seller ID format'),
  
  body('sellerName')
    .notEmpty()
    .withMessage('Seller name is required')
    .isString()
    .withMessage('Seller name must be a string'),
  
  body('amount')
    .notEmpty()
    .withMessage('Amount is required')
    .isFloat({ min: 0 })
    .withMessage('Amount must be a positive number'),
  
  body('dueDate')
    .notEmpty()
    .withMessage('Due date is required')
    .isISO8601()
    .withMessage('Due date must be a valid date'),
  
  body('items')
    .notEmpty()
    .withMessage('Items are required')
    .isArray()
    .withMessage('Items must be an array'),
  
  body('items.*.description')
    .notEmpty()
    .withMessage('Item description is required')
    .isString()
    .withMessage('Item description must be a string'),
  
  body('items.*.quantity')
    .notEmpty()
    .withMessage('Item quantity is required')
    .isInt({ min: 1 })
    .withMessage('Item quantity must be a positive integer'),
  
  body('items.*.unitPrice')
    .notEmpty()
    .withMessage('Item unit price is required')
    .isFloat({ min: 0 })
    .withMessage('Item unit price must be a positive number'),
  
  body('tax')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Tax must be a positive number'),
  
  validate
];

export const validateUpdateInvoiceStatus = [
  body('status')
    .notEmpty()
    .withMessage('Status is required')
    .isIn(['paid', 'due', 'cancelled'])
    .withMessage('Status must be one of: paid, due, cancelled'),
  
  body('paymentReference')
    .optional()
    .isString()
    .withMessage('Payment reference must be a string'),
  
  validate
];

// Rate Card Validators (Updated for unified model)
export const validateCreateRateCards = [
  body('rateCards')
    .notEmpty()
    .withMessage('Rate cards are required')
    .isArray()
    .withMessage('Rate cards must be an array'),
  
  body('rateCards.*.courier')
    .notEmpty()
    .withMessage('Courier name is required')
    .isString()
    .withMessage('Courier name must be a string'),
  
  body('rateCards.*.productName')
    .notEmpty()
    .withMessage('Product name is required')
    .isString()
    .withMessage('Product name must be a string'),
  
  body('rateCards.*.mode')
    .notEmpty()
    .withMessage('Mode is required')
    .isIn(['Surface', 'Air'])
    .withMessage('Mode must be either Surface or Air'),
  
  body('rateCards.*.zone')
    .notEmpty()
    .withMessage('Zone is required')
    .isIn(['Within City', 'Within State', 'Within Region', 'Metro to Metro', 'Rest of India', 'Special Zone'])
    .withMessage('Zone must be a valid zone type'),
  
  body('rateCards.*.baseRate')
    .notEmpty()
    .withMessage('Base rate is required')
    .isFloat({ min: 0 })
    .withMessage('Base rate must be a positive number'),
  
  body('rateCards.*.addlRate')
    .notEmpty()
    .withMessage('Additional rate is required')
    .isFloat({ min: 0 })
    .withMessage('Additional rate must be a positive number'),
  
  body('rateCards.*.codAmount')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('COD amount must be a positive number'),
  
  body('rateCards.*.codPercent')
    .optional()
    .isFloat({ min: 0, max: 100 })
    .withMessage('COD percent must be between 0 and 100'),
  
  body('rateCards.*.rtoCharges')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('RTO charges must be a positive number'),
  
  body('rateCards.*.minimumBillableWeight')
    .optional()
    .isFloat({ min: 0 })
    .withMessage('Minimum billable weight must be a positive number'),
  
  body('rateCards.*.isActive')
    .optional()
    .isBoolean()
    .withMessage('isActive must be a boolean'),
  
  validate
];

export const validateUpdateRateCards = [
  ...validateCreateRateCards,
  validate
];

// Legacy validators (kept for backward compatibility)
export const validateCreateRateCard = [
  body('rateBand')
    .notEmpty()
    .withMessage('Rate band is required')
    .isString()
    .withMessage('Rate band must be a string'),
  
  body('couriers')
    .notEmpty()
    .withMessage('Couriers are required')
    .isArray()
    .withMessage('Couriers must be an array'),
  
  body('couriers.*.name')
    .notEmpty()
    .withMessage('Courier name is required')
    .isString()
    .withMessage('Courier name must be a string'),
  
  body('couriers.*.rates')
    .notEmpty()
    .withMessage('Courier rates are required')
    .isObject()
    .withMessage('Courier rates must be an object'),
  
  body('couriers.*.rates.withinCity')
    .notEmpty()
    .withMessage('Within city rate is required')
    .isFloat({ min: 0 })
    .withMessage('Within city rate must be a positive number'),
  
  body('couriers.*.rates.withinState')
    .notEmpty()
    .withMessage('Within state rate is required')
    .isFloat({ min: 0 })
    .withMessage('Within state rate must be a positive number'),
  
  body('couriers.*.rates.metroToMetro')
    .notEmpty()
    .withMessage('Metro to metro rate is required')
    .isFloat({ min: 0 })
    .withMessage('Metro to metro rate must be a positive number'),
  
  body('couriers.*.rates.restOfIndia')
    .notEmpty()
    .withMessage('Rest of India rate is required')
    .isFloat({ min: 0 })
    .withMessage('Rest of India rate must be a positive number'),
  
  body('couriers.*.rates.northEastJK')
    .notEmpty()
    .withMessage('North East & J&K rate is required')
    .isFloat({ min: 0 })
    .withMessage('North East & J&K rate must be a positive number'),
  
  body('couriers.*.codCharge')
    .notEmpty()
    .withMessage('COD charge is required')
    .isFloat({ min: 0 })
    .withMessage('COD charge must be a positive number'),
  
  body('couriers.*.codPercent')
    .notEmpty()
    .withMessage('COD percent is required')
    .isFloat({ min: 0, max: 100 })
    .withMessage('COD percent must be between 0 and 100'),
  
  body('eligibleWeight')
    .notEmpty()
    .withMessage('Eligible weight is required')
    .isObject()
    .withMessage('Eligible weight must be an object'),
  
  body('eligibleWeight.min')
    .notEmpty()
    .withMessage('Minimum weight is required')
    .isFloat({ min: 0 })
    .withMessage('Minimum weight must be a positive number'),
  
  body('eligibleWeight.max')
    .notEmpty()
    .withMessage('Maximum weight is required')
    .isFloat({ min: 0 })
    .withMessage('Maximum weight must be a positive number')
    .custom((value, { req }) => {
      if (value <= req.body.eligibleWeight.min) {
        throw new Error('Maximum weight must be greater than minimum weight');
      }
      return true;
    }),
  
  validate
];

export const validateUpdateRateCard = [
  ...validateCreateRateCard,
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),
  
  validate
]; 