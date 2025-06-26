import Joi from 'joi';

// Register validation schema
export const registerSchema = Joi.object({
  name: Joi.string()
    .required()
    .min(2)
    .max(50)
    .messages({
      'string.empty': 'Name is required',
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  email: Joi.string()
    .required()
    .email()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address'
    }),
  mobile: Joi.string()
    .required()
    .pattern(/^[6-9]\d{9}$/)
    .messages({
      'string.empty': 'Mobile number is required',
      'string.pattern.base': 'Please provide a valid Indian mobile number'
    }),
  password: Joi.string()
    .required()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.empty': 'Password is required',
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref('password'))
    .messages({
      'string.empty': 'Please confirm your password',
      'any.only': 'Passwords do not match'
    }),
  acceptTerms: Joi.boolean()
    .required()
    .valid(true)
    .messages({
      'boolean.base': 'You must accept the terms and conditions',
      'any.only': 'You must accept the terms and conditions'
    }),
  mobileOtp: Joi.string()
    .required()
    .length(6)
    .pattern(/^\d+$/)
    .messages({
      'string.empty': 'Mobile OTP is required',
      'string.length': 'Mobile OTP must be 6 digits',
      'string.pattern.base': 'Mobile OTP must contain only digits'
    }),
  emailOtp: Joi.string()
    .required()
    .length(6)
    .pattern(/^\d+$/)
    .messages({
      'string.empty': 'Email OTP is required',
      'string.length': 'Email OTP must be 6 digits',
      'string.pattern.base': 'Email OTP must contain only digits'
    }),
  address1: Joi.string().optional(),
  address2: Joi.string().allow('').optional(),
  city: Joi.string().optional(),
  state: Joi.string().optional(),
  pincode: Joi.string().optional(),
  role: Joi.string().optional()
});

// Login validation schema
export const loginSchema = Joi.object({
  phoneOrEmail: Joi.string()
    .required()
    .messages({
      'string.empty': 'Phone number or email is required'
    }),
  password: Joi.string()
    .required()
    .messages({
      'string.empty': 'Password is required'
    }),
  otp: Joi.string()
    .length(6)
    .pattern(/^\d+$/)
    .messages({
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only digits'
    }),
  rememberMe: Joi.boolean()
    .default(false)
});

// OTP validation schema
export const otpSchema = Joi.object({
  phoneOrEmail: Joi.string()
    .required()
    .messages({
      'string.empty': 'Phone number or email is required'
    }),
  purpose: Joi.string()
    .required()
    .valid('login', 'reset', 'verify', 'register')
    .messages({
      'string.empty': 'Purpose is required',
      'any.only': 'Invalid purpose'
    })
});

// OTP verification validation schema
export const verifyOTPSchema = Joi.object({
  phoneOrEmail: Joi.string()
    .required()
    .messages({
      'string.empty': 'Phone number or email is required'
    }),
  otp: Joi.string()
    .required()
    .length(6)
    .pattern(/^\d+$/)
    .messages({
      'string.empty': 'OTP is required',
      'string.length': 'OTP must be 6 digits',
      'string.pattern.base': 'OTP must contain only digits'
    })
});

// Reset password validation schema
export const resetPasswordSchema = Joi.object({
  token: Joi.string()
    .required()
    .messages({
      'string.empty': 'Reset token is required'
    }),
  email: Joi.string()
    .required()
    .email()
    .messages({
      'string.empty': 'Email is required',
      'string.email': 'Please provide a valid email address'
    }),
  newPassword: Joi.string()
    .required()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .messages({
      'string.empty': 'New password is required',
      'string.min': 'Password must be at least 8 characters long',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    }),
  confirmPassword: Joi.string()
    .required()
    .valid(Joi.ref('newPassword'))
    .messages({
      'string.empty': 'Please confirm your password',
      'any.only': 'Passwords do not match'
    })
});

// Profile update validation schema
export const profileUpdateSchema = Joi.object({
  name: Joi.string()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Name must be at least 2 characters long',
      'string.max': 'Name cannot exceed 50 characters'
    }),
  fullName: Joi.string()
    .min(2)
    .max(50)
    .messages({
      'string.min': 'Full name must be at least 2 characters long',
      'string.max': 'Full name cannot exceed 50 characters'
    }),
  email: Joi.string()
    .email()
    .messages({
      'string.email': 'Please provide a valid email address'
    }),
  phone: Joi.string()
    .pattern(/^[6-9]\d{9}$/)
    .messages({
      'string.pattern.base': 'Please provide a valid Indian phone number'
    }),
  preferences: Joi.object({
    language: Joi.string()
      .valid('en', 'hi')
      .messages({
        'any.only': 'Invalid language selection'
      }),
    currency: Joi.string()
      .valid('INR', 'USD')
      .messages({
        'any.only': 'Invalid currency selection'
      }),
    notifications: Joi.object({
      email: Joi.boolean(),
      sms: Joi.boolean(),
      push: Joi.boolean()
    })
  })
});

// Address validation schema
export const addressSchema = Joi.object({
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
    .default('India'),
  isDefault: Joi.boolean()
    .default(false)
});
