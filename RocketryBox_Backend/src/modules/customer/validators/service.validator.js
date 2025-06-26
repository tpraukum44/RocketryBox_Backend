import Joi from 'joi';

// Check availability validation schema
export const checkAvailabilitySchema = Joi.object({
  pickupPincode: Joi.string()
    .required()
    .pattern(/^\d{6}$/)
    .messages({
      'string.empty': 'Pickup pincode is required',
      'string.pattern.base': 'Please provide a valid 6-digit pincode'
    }),
  deliveryPincode: Joi.string()
    .required()
    .pattern(/^\d{6}$/)
    .messages({
      'string.empty': 'Delivery pincode is required',
      'string.pattern.base': 'Please provide a valid 6-digit pincode'
    }),
  package: Joi.object({
    weight: Joi.number()
      .required()
      .min(0.1)
      .messages({
        'number.base': 'Weight must be a number',
        'number.min': 'Weight must be at least 0.1 kg'
      }),
    dimensions: Joi.object({
      length: Joi.number()
        .required()
        .min(1)
        .messages({
          'number.base': 'Length must be a number',
          'number.min': 'Length must be at least 1 cm'
        }),
      width: Joi.number()
        .required()
        .min(1)
        .messages({
          'number.base': 'Width must be a number',
          'number.min': 'Width must be at least 1 cm'
        }),
      height: Joi.number()
        .required()
        .min(1)
        .messages({
          'number.base': 'Height must be a number',
          'number.min': 'Height must be at least 1 cm'
        })
    }).required()
  }).required()
}); 