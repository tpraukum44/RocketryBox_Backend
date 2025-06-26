import Joi from 'joi';

// Zone schema validator
const zoneSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Zone name is required',
    'any.required': 'Zone name is required'
  }),
  baseRate: Joi.number().min(0).required().messages({
    'number.base': 'Base rate must be a number',
    'number.min': 'Base rate cannot be negative',
    'any.required': 'Base rate is required'
  }),
  additionalRate: Joi.number().min(0).required().messages({
    'number.base': 'Additional rate must be a number',
    'number.min': 'Additional rate cannot be negative',
    'any.required': 'Additional rate is required'
  })
});

// Weight limits schema validator
const weightLimitsSchema = Joi.object({
  min: Joi.number().min(0).required().messages({
    'number.base': 'Minimum weight must be a number',
    'number.min': 'Minimum weight cannot be negative',
    'any.required': 'Minimum weight is required'
  }),
  max: Joi.number().min(0).required().messages({
    'number.base': 'Maximum weight must be a number',
    'number.min': 'Maximum weight cannot be negative',
    'any.required': 'Maximum weight is required'
  })
}).custom((value, helpers) => {
  if (value.min >= value.max) {
    return helpers.error('object.custom', { message: 'Minimum weight must be less than maximum weight' });
  }
  return value;
});

// Dimension limits schema validator
const dimensionLimitsSchema = Joi.object({
  maxLength: Joi.number().min(0).messages({
    'number.base': 'Maximum length must be a number',
    'number.min': 'Maximum length cannot be negative'
  }),
  maxWidth: Joi.number().min(0).messages({
    'number.base': 'Maximum width must be a number',
    'number.min': 'Maximum width cannot be negative'
  }),
  maxHeight: Joi.number().min(0).messages({
    'number.base': 'Maximum height must be a number',
    'number.min': 'Maximum height cannot be negative'
  }),
  maxSum: Joi.number().min(0).messages({
    'number.base': 'Maximum sum must be a number',
    'number.min': 'Maximum sum cannot be negative'
  })
});

// Rates schema validator
const ratesSchema = Joi.object({
  baseRate: Joi.number().min(0).required().messages({
    'number.base': 'Base rate must be a number',
    'number.min': 'Base rate cannot be negative',
    'any.required': 'Base rate is required'
  }),
  weightRate: Joi.number().min(0).required().messages({
    'number.base': 'Weight rate must be a number',
    'number.min': 'Weight rate cannot be negative',
    'any.required': 'Weight rate is required'
  }),
  dimensionalFactor: Joi.number().min(0).default(5000).messages({
    'number.base': 'Dimensional factor must be a number',
    'number.min': 'Dimensional factor cannot be negative'
  })
});

// Create shipping partner validator
export const createShippingPartnerSchema = Joi.object({
  name: Joi.string().required().messages({
    'string.empty': 'Partner name is required',
    'any.required': 'Partner name is required'
  }),
  logoUrl: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'Logo URL must be a valid URI'
  }),
  apiStatus: Joi.string().valid('active', 'inactive', 'maintenance').default('inactive').messages({
    'any.only': 'API status must be one of: active, inactive, maintenance'
  }),
  supportContact: Joi.string().required().messages({
    'string.empty': 'Support contact is required',
    'any.required': 'Support contact is required'
  }),
  supportEmail: Joi.string().email().required().messages({
    'string.email': 'Support email must be a valid email',
    'string.empty': 'Support email is required',
    'any.required': 'Support email is required'
  }),
  apiKey: Joi.string().allow('').optional(),
  apiEndpoint: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'API endpoint must be a valid URI'
  }),
  serviceTypes: Joi.array().items(Joi.string()).default([]),
  serviceAreas: Joi.array().items(Joi.string()).default([]),
  weightLimits: weightLimitsSchema.required().messages({
    'any.required': 'Weight limits are required'
  }),
  dimensionLimits: dimensionLimitsSchema.optional(),
  rates: ratesSchema.required().messages({
    'any.required': 'Rates are required'
  }),
  zones: Joi.array().items(zoneSchema).default([]),
  trackingUrl: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'Tracking URL must be a valid URI'
  }),
  notes: Joi.string().allow('').optional()
});

// Update shipping partner validator
export const updateShippingPartnerSchema = Joi.object({
  name: Joi.string().optional().messages({
    'string.empty': 'Partner name cannot be empty'
  }),
  logoUrl: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'Logo URL must be a valid URI'
  }),
  apiStatus: Joi.string().valid('active', 'inactive', 'maintenance').optional().messages({
    'any.only': 'API status must be one of: active, inactive, maintenance'
  }),
  supportContact: Joi.string().optional().messages({
    'string.empty': 'Support contact cannot be empty'
  }),
  supportEmail: Joi.string().email().optional().messages({
    'string.email': 'Support email must be a valid email',
    'string.empty': 'Support email cannot be empty'
  }),
  apiKey: Joi.string().allow('').optional(),
  apiEndpoint: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'API endpoint must be a valid URI'
  }),
  serviceTypes: Joi.array().items(Joi.string()).optional(),
  serviceAreas: Joi.array().items(Joi.string()).optional(),
  weightLimits: weightLimitsSchema.optional(),
  dimensionLimits: dimensionLimitsSchema.optional(),
  rates: ratesSchema.optional(),
  zones: Joi.array().items(zoneSchema).optional(),
  trackingUrl: Joi.string().uri().allow('').optional().messages({
    'string.uri': 'Tracking URL must be a valid URI'
  }),
  notes: Joi.string().allow('').optional(),
  statusReason: Joi.string().optional()
});

// Update shipping partner status validator
export const updatePartnerStatusSchema = Joi.object({
  status: Joi.string().valid('active', 'inactive', 'maintenance').required().messages({
    'any.only': 'Status must be one of: active, inactive, maintenance',
    'any.required': 'Status is required'
  }),
  reason: Joi.string().allow('').optional()
});

// Update shipping partner performance validator
export const updatePartnerPerformanceSchema = Joi.object({
  deliverySuccess: Joi.number().min(0).max(100).required().messages({
    'number.base': 'Delivery success must be a number',
    'number.min': 'Delivery success cannot be negative',
    'number.max': 'Delivery success cannot exceed 100%',
    'any.required': 'Delivery success is required'
  }),
  onTimeDelivery: Joi.number().min(0).max(100).required().messages({
    'number.base': 'On-time delivery must be a number',
    'number.min': 'On-time delivery cannot be negative',
    'number.max': 'On-time delivery cannot exceed 100%',
    'any.required': 'On-time delivery is required'
  }),
  pickupSuccess: Joi.number().min(0).max(100).required().messages({
    'number.base': 'Pickup success must be a number',
    'number.min': 'Pickup success cannot be negative',
    'number.max': 'Pickup success cannot exceed 100%',
    'any.required': 'Pickup success is required'
  }),
  exceptionRate: Joi.number().min(0).max(100).required().messages({
    'number.base': 'Exception rate must be a number',
    'number.min': 'Exception rate cannot be negative',
    'number.max': 'Exception rate cannot exceed 100%',
    'any.required': 'Exception rate is required'
  }),
  averageDeliveryTime: Joi.number().min(0).required().messages({
    'number.base': 'Average delivery time must be a number',
    'number.min': 'Average delivery time cannot be negative',
    'any.required': 'Average delivery time is required'
  }),
  complaintResolutionTime: Joi.number().min(0).required().messages({
    'number.base': 'Complaint resolution time must be a number',
    'number.min': 'Complaint resolution time cannot be negative',
    'any.required': 'Complaint resolution time is required'
  })
});

// Update shipping partner rates validator
export const updatePartnerRatesSchema = Joi.object({
  rates: ratesSchema.optional(),
  zones: Joi.array().items(zoneSchema).optional()
}).or('rates', 'zones').messages({
  'object.missing': 'At least one of rates or zones must be provided'
}); 