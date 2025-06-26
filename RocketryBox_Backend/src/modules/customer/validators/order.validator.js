import Joi from 'joi';

// Package item validation schema
const packageItemSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(2)
    .max(50)
    .messages({
      'string.empty': 'Item name is required',
      'string.min': 'Item name must be at least 2 characters long',
      'string.max': 'Item name cannot exceed 50 characters'
    }),
  quantity: Joi.number()
    .required()
    .min(1)
    .messages({
      'number.base': 'Quantity must be a number',
      'number.min': 'Quantity must be at least 1'
    }),
  value: Joi.number()
    .required()
    .min(0)
    .messages({
      'number.base': 'Value must be a number',
      'number.min': 'Value cannot be negative'
    })
});

// Package validation schema
const packageSchema = Joi.object({
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
  }).required(),
  items: Joi.array()
    .items(packageItemSchema)
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one item is required'
    })
});

// Address validation schema
const addressSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(2)
    .max(50)
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  phone: Joi.string()
    .required()
    .pattern(/^[6-9]\d{9}$/)
    .messages({
      'string.empty': 'Phone number is required',
      'string.pattern.base': 'Please provide a valid Indian phone number'
    }),
  address1: Joi.string()
    .required()
    .min(5)
    .max(100)
    .messages({
      'string.empty': 'Address line 1 is required',
      'string.min': 'Address line 1 must be at least 5 characters long',
      'string.max': 'Address line 1 cannot exceed 100 characters'
    }),
  address2: Joi.string()
    .max(100)
    .messages({
      'string.max': 'Address line 2 cannot exceed 100 characters'
    }),
  city: Joi.string()
    .required()
    .min(2)
    .max(50)
    .messages({
      'string.empty': 'City is required',
      'string.min': 'City must be at least 2 characters long',
      'string.max': 'City cannot exceed 50 characters'
    }),
  state: Joi.string()
    .required()
    .min(2)
    .max(50)
    .messages({
      'string.empty': 'State is required',
      'string.min': 'State must be at least 2 characters long',
      'string.max': 'State cannot exceed 50 characters'
    }),
  pincode: Joi.string()
    .required()
    .pattern(/^\d{6}$/)
    .messages({
      'string.empty': 'Pincode is required',
      'string.pattern.base': 'Please provide a valid 6-digit pincode'
    }),
  country: Joi.string()
    .default('India')
});

// Selected provider validation schema
const selectedProviderSchema = Joi.object({
  id: Joi.string()
    .required()
    .messages({
      'string.empty': 'Provider ID is required'
    }),
  name: Joi.string()
    .required()
    .messages({
      'string.empty': 'Provider name is required'
    }),
  serviceType: Joi.string()
    .required()
    .valid('standard', 'express')
    .messages({
      'string.empty': 'Service type is required',
      'any.only': 'Invalid service type'
    }),
  totalRate: Joi.number()
    .required()
    .min(0)
    .messages({
      'number.base': 'Total rate must be a number',
      'number.min': 'Total rate cannot be negative'
    }),
  estimatedDays: Joi.string()
    .required()
    .messages({
      'string.empty': 'Estimated days is required'
    })
});

// Create order validation schema
export const createOrderSchema = Joi.object({
  pickupAddress: addressSchema.required(),
  deliveryAddress: addressSchema.required(),
  package: packageSchema.required(),
  selectedProvider: selectedProviderSchema.optional(),
  serviceType: Joi.string()
    .required()
    .valid('standard', 'express')
    .messages({
      'string.empty': 'Service type is required',
      'any.only': 'Invalid service type'
    }),
  paymentMethod: Joi.string()
    .required()
    .valid('online')
    .messages({
      'string.empty': 'Payment method is required',
      'any.only': 'Only online payment is allowed for customers'
    }),
  instructions: Joi.string()
    .allow('')
    .max(200)
    .messages({
      'string.max': 'Instructions cannot exceed 200 characters'
    }),
  pickupDate: Joi.date()
    .required()
    .min('now')
    .messages({
      'date.base': 'Invalid pickup date',
      'date.min': 'Pickup date must be in the future'
    })
});

// List orders validation schema
export const listOrdersSchema = Joi.object({
  page: Joi.number()
    .min(1)
    .default(1)
    .messages({
      'number.base': 'Page must be a number',
      'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number()
    .min(1)
    .max(100)
    .default(10)
    .messages({
      'number.base': 'Limit must be a number',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    }),
  query: Joi.string()
    .max(50)
    .messages({
      'string.max': 'Search query cannot exceed 50 characters'
    }),
  sortField: Joi.string()
    .valid('createdAt', 'status', 'amount')
    .default('createdAt')
    .messages({
      'any.only': 'Invalid sort field'
    }),
  sortDirection: Joi.string()
    .valid('asc', 'desc')
    .default('desc')
    .messages({
      'any.only': 'Invalid sort direction'
    }),
  status: Joi.string()
    .valid('Booked', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled')
    .messages({
      'any.only': 'Invalid status'
    }),
  startDate: Joi.date()
    .messages({
      'date.base': 'Invalid start date'
    }),
  endDate: Joi.date()
    .min(Joi.ref('startDate'))
    .messages({
      'date.base': 'Invalid end date',
      'date.min': 'End date must be after start date'
    })
});

// Create payment validation schema
export const createPaymentSchema = Joi.object({
  amount: Joi.number()
    .required()
    .min(1)
    .messages({
      'number.base': 'Amount must be a number',
      'number.min': 'Amount must be at least 1'
    }),
  currency: Joi.string()
    .required()
    .valid('INR')
    .messages({
      'string.empty': 'Currency is required',
      'any.only': 'Only INR currency is supported'
    }),
  awbNumber: Joi.string()
    .required()
    .pattern(/^RB\d{10}$/)
    .messages({
      'string.empty': 'AWB number is required',
      'string.pattern.base': 'Invalid AWB number format'
    }),
  paymentMethod: Joi.string()
    .required()
    .valid('online')
    .messages({
      'string.empty': 'Payment method is required',
      'any.only': 'Only online payment is allowed for customers'
    })
});

// Verify payment validation schema
export const verifyPaymentSchema = Joi.object({
  awbNumber: Joi.string()
    .required()
    .pattern(/^RB\d{10}$/)
    .messages({
      'string.empty': 'AWB number is required',
      'string.pattern.base': 'Invalid AWB number format'
    }),
  razorpay_payment_id: Joi.string()
    .required()
    .messages({
      'string.empty': 'Payment ID is required'
    }),
  razorpay_order_id: Joi.string()
    .required()
    .messages({
      'string.empty': 'Order ID is required'
    }),
  razorpay_signature: Joi.string()
    .required()
    .messages({
      'string.empty': 'Signature is required'
    })
});

// Subscribe tracking validation schema
export const subscribeTrackingSchema = Joi.object({
  channels: Joi.array()
    .items(Joi.string().valid('email', 'sms', 'push'))
    .min(1)
    .required()
    .messages({
      'array.min': 'At least one channel is required',
      'array.includesRequiredUnknowns': 'Invalid channel'
    }),
  frequency: Joi.string()
    .required()
    .valid('realtime', 'daily', 'status_change')
    .messages({
      'string.empty': 'Frequency is required',
      'any.only': 'Invalid frequency'
    })
});

// Refund payment validation schema
export const refundSchema = Joi.object({
  amount: Joi.number()
    .required()
    .min(1)
    .messages({
      'number.base': 'Amount must be a number',
      'number.min': 'Amount must be at least 1'
    }),
  reason: Joi.string()
    .required()
    .max(200)
    .messages({
      'string.empty': 'Reason is required',
      'string.max': 'Reason cannot exceed 200 characters'
    })
});

// Calculate rates validation schema
export const calculateRatesSchema = Joi.object({
  weight: Joi.number()
    .required()
    .min(0.1)
    .messages({
      'number.base': 'Weight must be a number',
      'number.min': 'Weight must be at least 0.1 kg'
    }),
  pickupPincode: Joi.string()
    .required()
    .pattern(/^\d{6}$/)
    .messages({
      'string.empty': 'Pickup pincode is required',
      'string.pattern.base': 'Please provide a valid 6-digit pickup pincode'
    }),
  deliveryPincode: Joi.string()
    .required()
    .pattern(/^\d{6}$/)
    .messages({
      'string.empty': 'Delivery pincode is required',
      'string.pattern.base': 'Please provide a valid 6-digit delivery pincode'
    }),
  serviceType: Joi.string()
    .required()
    .valid('standard', 'express', 'cod')
    .messages({
      'string.empty': 'Service type is required',
      'any.only': 'Invalid service type'
    })
}); 