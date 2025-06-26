import { body } from 'express-validator';

export const calculateRateSchema = [
  body('weight')
    .isFloat({ min: 0.1 })
    .withMessage('Weight must be a positive number'),
  
  body('pickupPincode')
    .isNumeric()
    .isLength({ min: 6, max: 6 })
    .withMessage('Pickup pincode must be a 6-digit number'),
  
  body('deliveryPincode')
    .isNumeric()
    .isLength({ min: 6, max: 6 })
    .withMessage('Delivery pincode must be a 6-digit number'),
  
  body('isCOD')
    .optional()
    .isBoolean()
    .withMessage('isCOD must be a boolean value')
]; 