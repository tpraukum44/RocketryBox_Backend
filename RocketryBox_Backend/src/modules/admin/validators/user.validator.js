import { body, param, query } from 'express-validator';
import Joi from 'joi';
import mongoose from 'mongoose';

// Generic user query validation for getAllUsers
export const userQueryValidator = [
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
  query('userType')
    .optional()
    .isIn(['seller', 'customer', 'all'])
    .withMessage('User type must be seller, customer, or all'),
  query('status')
    .optional()
    .isString()
    .withMessage('Status must be a string')
];

// Generic user ID validation - supports both MongoDB ObjectId and RB user IDs
export const userIdValidator = [
  param('id')
    .custom((value) => {
      // Allow MongoDB ObjectId format
      if (mongoose.Types.ObjectId.isValid(value)) {
        return true;
      }

      // Allow RB user ID format (RBS, RBC followed by numbers)
      const rbUserIdPattern = /^RB[SC]\d+$/;
      if (rbUserIdPattern.test(value)) {
        return true;
      }

      throw new Error('Invalid user ID format');
    })
    .withMessage('Valid user ID is required (MongoDB ObjectId or RB user ID format)')
];

// Update user status validation
export const updateUserStatusValidator = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid user ID format');
      }
      return true;
    })
    .withMessage('Valid user ID is required'),
  body('status')
    .isIn(['active', 'inactive', 'suspended', 'pending'])
    .withMessage('Status must be active, inactive, suspended, or pending'),
  body('reason')
    .optional()
    .isString()
    .trim()
    .isLength({ min: 1 })
    .withMessage('Reason must be a non-empty string if provided')
];

// Update user permissions validation
export const updateUserPermissionsValidator = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid user ID format');
      }
      return true;
    })
    .withMessage('Valid user ID is required'),
  body('permissions')
    .isObject()
    .withMessage('Permissions must be an object'),
  body('permissions.*')
    .optional()
    .isBoolean()
    .withMessage('Each permission value must be a boolean')
];

// Validate seller ID parameter using express-validator
export const validateSellerIdParam = [
  param('id')
    .custom((value) => {
      if (!mongoose.Types.ObjectId.isValid(value)) {
        throw new Error('Invalid seller ID format');
      }
      return true;
    })
    .withMessage('Valid seller ID is required')
];

// Update seller bank details validation schema
export const updateSellerBankDetailsSchema = Joi.object({
  bankDetails: Joi.object({
    accountType: Joi.string().valid('savings', 'current', 'Current Account').optional().messages({
      'any.only': 'Account type must be either savings, current, or Current Account'
    }),
    bankName: Joi.string().min(1).optional().messages({
      'string.empty': 'Bank name cannot be empty',
      'string.min': 'Bank name is required'
    }),
    accountNumber: Joi.string().min(9).max(18).pattern(/^\d+$/).optional().messages({
      'string.min': 'Account number must be at least 9 digits',
      'string.max': 'Account number cannot exceed 18 digits',
      'string.pattern.base': 'Account number must contain only digits'
    }),
    accountHolderName: Joi.string().min(1).optional().messages({
      'string.empty': 'Account holder name cannot be empty',
      'string.min': 'Account holder name is required'
    }),
    branchName: Joi.string().min(1).optional().messages({
      'string.empty': 'Branch name cannot be empty',
      'string.min': 'Branch name is required'
    }),
    ifscCode: Joi.string().length(11).pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).optional().messages({
      'string.length': 'IFSC code must be exactly 11 characters',
      'string.pattern.base': 'Invalid IFSC code format (e.g., SBIN0001234)'
    }),
    cancelledCheque: Joi.object({
      url: Joi.string().uri().optional().messages({
        'string.uri': 'Invalid cancelled cheque document URL'
      }),
      status: Joi.string().valid('verified', 'pending', 'rejected').optional().messages({
        'any.only': 'Cancelled cheque status must be either verified, pending, or rejected'
      })
    }).optional()
  }).required().messages({
    'object.base': 'Bank details must be an object',
    'any.required': 'Bank details are required'
  })
});

// Validation schema for verifying documents specifically
export const verifyDocumentSchema = Joi.object({
  bankDetails: Joi.object({
    cancelledCheque: Joi.object({
      status: Joi.string().valid('verified', 'rejected').required().messages({
        'any.only': 'Status must be either verified or rejected',
        'any.required': 'Status is required'
      }),
      url: Joi.string().uri().required().messages({
        'string.uri': 'Valid document URL is required',
        'any.required': 'Document URL is required'
      })
    }).required()
  }).unknown(true) // Allow other fields to be passed through
});

// Update seller status validation schema
export const updateSellerStatusSchema = Joi.object({
  status: Joi.string().valid('pending', 'active', 'suspended').required().messages({
    'string.empty': 'Status is required',
    'any.only': 'Status must be either pending, active, or suspended'
  }),
  reason: Joi.string().optional().messages({
    'string.empty': 'Reason cannot be empty'
  })
});

// Update seller KYC validation schema
export const updateSellerKYCSchema = Joi.object({
  status: Joi.string().valid('approved', 'rejected', 'pending').required().messages({
    'string.empty': 'KYC status is required',
    'any.only': 'KYC status must be either approved, rejected, or pending'
  }),
  comments: Joi.string().optional().messages({
    'string.empty': 'Comments cannot be empty'
  })
});

// Update seller rate band validation schema
export const updateSellerRateBandSchema = Joi.object({
  rateBand: Joi.string().optional().allow('', null).messages({
    'string.empty': 'Rate band can be empty to use default RBX1'
  }),
  paymentType: Joi.string().valid('wallet', 'credit').optional().messages({
    'any.only': 'Payment type must be either wallet or credit'
  }),
  creditLimit: Joi.number().min(0).optional().messages({
    'number.min': 'Credit limit must be a positive number'
  }),
  creditPeriod: Joi.number().min(0).max(365).optional().messages({
    'number.min': 'Credit period must be a positive number',
    'number.max': 'Credit period cannot exceed 365 days'
  })
});
