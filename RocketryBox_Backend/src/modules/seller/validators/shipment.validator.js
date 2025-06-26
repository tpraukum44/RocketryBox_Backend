import Joi from 'joi';

export const createShipmentSchema = Joi.object({
  orderId: Joi.string().required(),
  courier: Joi.string().required(),
  awb: Joi.string().required(),
  pickupDate: Joi.date().optional()
});

export const createBulkShipmentsSchema = Joi.object({
  shipments: Joi.array().items(
    Joi.object({
      orderId: Joi.string().required(),
      courier: Joi.string().required(),
      awb: Joi.string().required(),
      pickupDate: Joi.date().optional()
    })
  ).min(1).required()
});

export const shippingRatesSchema = Joi.object({
  weight: Joi.number().positive().required().messages({
    'number.base': 'Weight must be a number',
    'number.positive': 'Weight must be positive',
    'any.required': 'Weight is required'
  }),
  dimensions: Joi.object({
    length: Joi.number().positive().required().messages({
      'number.base': 'Length must be a number',
      'number.positive': 'Length must be positive',
      'any.required': 'Length is required'
    }),
    width: Joi.number().positive().required().messages({
      'number.base': 'Width must be a number',
      'number.positive': 'Width must be positive',
      'any.required': 'Width is required'
    }),
    height: Joi.number().positive().required().messages({
      'number.base': 'Height must be a number',
      'number.positive': 'Height must be positive',
      'any.required': 'Height is required'
    })
  }).required().messages({
    'any.required': 'Dimensions are required'
  }),
  pickupPincode: Joi.string().pattern(/^\d{6}$/).required().messages({
    'string.pattern.base': 'Pickup pincode must be a 6-digit number',
    'any.required': 'Pickup pincode is required'
  }),
  deliveryPincode: Joi.string().pattern(/^\d{6}$/).required().messages({
    'string.pattern.base': 'Delivery pincode must be a 6-digit number',
    'any.required': 'Delivery pincode is required'
  }),
  cod: Joi.boolean().default(false),
  declaredValue: Joi.number().min(0).default(0)
});

export const courierBookingSchema = Joi.object({
  orderId: Joi.string().required().messages({
    'any.required': 'Order ID is required'
  }),
  courierCode: Joi.string().required().messages({
    'any.required': 'Courier code is required'
  }),
  serviceType: Joi.string().required().messages({
    'any.required': 'Service type is required'
  }),
  packageDetails: Joi.object({
    weight: Joi.number().positive().required(),
    dimensions: Joi.object({
      length: Joi.number().positive().required(),
      width: Joi.number().positive().required(),
      height: Joi.number().positive().required()
    }).required(),
    declaredValue: Joi.number().min(0).optional(),
    shippingCharge: Joi.number().min(0).optional()
  }).required().messages({
    'any.required': 'Package details are required'
  }),
  pickupDetails: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().optional(),
    address: Joi.object({
      street: Joi.string().required(),
      landmark: Joi.string().optional(),
      city: Joi.string().required(),
      state: Joi.string().required(),
      pincode: Joi.string().pattern(/^\d{6}$/).required(),
      country: Joi.string().default('India')
    }).required()
  }).required().messages({
    'any.required': 'Pickup details are required'
  })
});

export const updateShipmentStatusSchema = Joi.object({
  status: Joi.string().valid('Booked', 'In-transit', 'Delivered', 'Pending Pickup', 'Cancelled', 'Exception').required()
});

export const addTrackingEventSchema = Joi.object({
  status: Joi.string().required(),
  description: Joi.string().optional(),
  location: Joi.string().optional()
});

export const handleReturnSchema = Joi.object({
  reason: Joi.string().required(),
  notes: Joi.string().optional(),
  action: Joi.string().valid('Reattempt', 'Return', 'Dispose').required()
});

// Validation middleware function
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, error: error.details[0].message });
    }
    next();
  };
};

// Export validation middleware functions
export const validateCreateShipment = validateRequest(createShipmentSchema);
export const validateCreateBulkShipments = validateRequest(createBulkShipmentsSchema);
export const validateShippingRates = validateRequest(shippingRatesSchema);
export const validateCourierBooking = validateRequest(courierBookingSchema);
export const validateUpdateShipmentStatus = validateRequest(updateShipmentStatusSchema);
export const validateAddTrackingEvent = validateRequest(addTrackingEventSchema);
export const validateHandleReturn = validateRequest(handleReturnSchema); 