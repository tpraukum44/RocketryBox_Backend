import Joi from 'joi';

export const loginSchema = Joi.object({
  emailOrPhone: Joi.string().required().messages({
    'string.empty': 'Email or phone is required'
  }),
  password: Joi.string(),
  otp: Joi.string().length(6),
  rememberMe: Joi.boolean().default(false)
}).or('password', 'otp').messages({
  'object.missing': 'Password or OTP is required'
});

export const sendOTPSchema = Joi.object({
  emailOrPhone: Joi.string().messages({
    'string.empty': 'Email or phone is required'
  }),
  email: Joi.string().email().messages({
    'string.email': 'Invalid email format'
  }),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).messages({
    'string.pattern.base': 'Please provide a valid Indian phone number'
  }),
  purpose: Joi.string().valid('login', 'reset', 'verify', 'register').required().messages({
    'any.only': 'Purpose must be login, reset, verify, or register',
    'string.empty': 'Purpose is required'
  })
}).or('emailOrPhone', 'email', 'phone').messages({
  'object.missing': 'Email, phone, or emailOrPhone is required'
});

export const verifyOTPSchema = Joi.object({
  emailOrPhone: Joi.string().required().messages({
    'string.empty': 'Email or phone is required'
  }),
  otp: Joi.string().length(6).required().messages({
    'string.empty': 'OTP is required',
    'string.length': 'OTP must be 6 digits'
  }),
  purpose: Joi.string().valid('login', 'reset', 'verify', 'register')
});

export const resetPasswordSchema = Joi.object({
  emailOrPhone: Joi.string().required().messages({
    'string.empty': 'Email or phone is required'
  }),
  otp: Joi.string().length(6).required().messages({
    'string.empty': 'OTP is required',
    'string.length': 'OTP must be 6 digits'
  }),
  newPassword: Joi.string().min(6).required().messages({
    'string.empty': 'New password is required',
    'string.min': 'Password must be at least 6 characters'
  }),
  confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
    'any.only': 'Passwords do not match',
    'string.empty': 'Confirm password is required'
  })
});

// Initial Registration Schema
export const registerSchema = Joi.object({
  firstName: Joi.string().min(2).max(50).required().messages({
    'string.empty': 'First name is required',
    'string.min': 'First name must be at least 2 characters',
    'string.max': 'First name cannot exceed 50 characters'
  }),
  lastName: Joi.string().min(2).max(50).required().messages({
    'string.empty': 'Last name is required',
    'string.min': 'Last name must be at least 2 characters',
    'string.max': 'Last name cannot exceed 50 characters'
  }),
  email: Joi.string().email().required().messages({
    'string.empty': 'Email is required',
    'string.email': 'Invalid email format'
  }),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/).required().messages({
    'string.empty': 'Phone number is required',
    'string.pattern.base': 'Please provide a valid Indian phone number'
  }),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/).required().messages({
    'string.empty': 'Password is required',
    'string.min': 'Password must be at least 8 characters',
    'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, one number and one special character'
  }),
  companyName: Joi.string().min(2).max(100).required().messages({
    'string.empty': 'Company name is required',
    'string.min': 'Company name must be at least 2 characters',
    'string.max': 'Company name cannot exceed 100 characters'
  }),
  monthlyShipments: Joi.string().valid('0-100', '101-500', '501-1000', '1001-5000', '5000+').required().messages({
    'string.empty': 'Monthly shipments is required',
    'any.only': 'Invalid monthly shipments value'
  }),
  otp: Joi.string().length(6).required().messages({
    'string.empty': 'OTP is required',
    'string.length': 'OTP must be 6 digits'
  }),
  // Optional bank details during registration
  bankDetails: Joi.object({
    accountType: Joi.string().valid('savings', 'current').messages({
      'any.only': 'Account type must be either savings or current'
    }),
    bankName: Joi.string().messages({
      'string.empty': 'Bank name cannot be empty'
    }),
    accountNumber: Joi.string().min(9).max(18).pattern(/^\d+$/).messages({
      'string.min': 'Account number must be at least 9 digits',
      'string.max': 'Account number cannot exceed 18 digits',
      'string.pattern.base': 'Account number must contain only digits'
    }),
    accountHolderName: Joi.string().messages({
      'string.empty': 'Account holder name cannot be empty'
    }),
    branchName: Joi.string().required().messages({
      'string.empty': 'Branch name is required'
    }),
    ifscCode: Joi.string().length(11).pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).messages({
      'string.length': 'IFSC code must be 11 characters',
      'string.pattern.base': 'Invalid IFSC code format'
    }),
    cancelledCheque: Joi.object({
      url: Joi.string().uri().messages({
        'string.uri': 'Invalid cancelled cheque document URL'
      })
    })
  }).optional()
});

// Company Details Update Schema
export const companyDetailsSchema = Joi.object({
  companyCategory: Joi.string().required().messages({
    'string.empty': 'Company category is required'
  }),
  documents: Joi.object({
    gstin: Joi.object({
      number: Joi.string().length(15).pattern(/^[0-9A-Z]{15}$/).required().messages({
        'string.empty': 'GST number is required',
        'string.length': 'GST number must be 15 characters',
        'string.pattern.base': 'Invalid GST number format'
      }),
      url: Joi.string().uri().required().messages({
        'string.empty': 'GST document URL is required',
        'string.uri': 'Invalid GST document URL'
      })
    }),
    pan: Joi.object({
      number: Joi.string().length(10).pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required().messages({
        'string.empty': 'PAN number is required',
        'string.length': 'PAN number must be 10 characters',
        'string.pattern.base': 'Invalid PAN number format'
      }),
      url: Joi.string().uri().required().messages({
        'string.empty': 'PAN document URL is required',
        'string.uri': 'Invalid PAN document URL'
      })
    }),
    aadhaar: Joi.object({
      number: Joi.string().length(12).pattern(/^\d{12}$/).required().messages({
        'string.empty': 'Aadhaar number is required',
        'string.length': 'Aadhaar number must be 12 digits',
        'string.pattern.base': 'Invalid Aadhaar number format'
      }),
      url: Joi.string().uri().required().messages({
        'string.empty': 'Aadhaar document URL is required',
        'string.uri': 'Invalid Aadhaar document URL'
      })
    })
  }).required(),
  address: Joi.object({
    address1: Joi.string().required().messages({
      'string.empty': 'Address line 1 is required'
    }),
    address2: Joi.string().allow(''),
    city: Joi.string().required().messages({
      'string.empty': 'City is required'
    }),
    state: Joi.string().required().messages({
      'string.empty': 'State is required'
    }),
    pincode: Joi.string().length(6).pattern(/^[1-9][0-9]{5}$/).required().messages({
      'string.empty': 'Pincode is required',
      'string.length': 'Pincode must be 6 digits',
      'string.pattern.base': 'Invalid pincode format'
    }),
    country: Joi.string().default('India')
  }).required()
});

// Bank Details Update Schema
export const bankDetailsSchema = Joi.object({
  accountType: Joi.string().valid('savings', 'current').required().messages({
    'string.empty': 'Account type is required',
    'any.only': 'Account type must be either savings or current'
  }),
  bankName: Joi.string().required().messages({
    'string.empty': 'Bank name is required'
  }),
  accountNumber: Joi.string().min(9).max(18).pattern(/^\d+$/).required().messages({
    'string.empty': 'Account number is required',
    'string.min': 'Account number must be at least 9 digits',
    'string.max': 'Account number cannot exceed 18 digits',
    'string.pattern.base': 'Account number must contain only digits'
  }),
  accountHolderName: Joi.string().required().messages({
    'string.empty': 'Account holder name is required'
  }),
  branchName: Joi.string().required().messages({
    'string.empty': 'Branch name is required'
  }),
  ifscCode: Joi.string().length(11).pattern(/^[A-Z]{4}0[A-Z0-9]{6}$/).required().messages({
    'string.empty': 'IFSC code is required',
    'string.length': 'IFSC code must be 11 characters',
    'string.pattern.base': 'Invalid IFSC code format'
  }),
  cancelledCheque: Joi.object({
    url: Joi.string().uri().required().messages({
      'string.empty': 'Cancelled cheque document URL is required',
      'string.uri': 'Invalid cancelled cheque document URL'
    })
  }).required()
});

// Profile Update Schema
export const profileUpdateSchema = Joi.object({
  firstName: Joi.string().min(2).max(50),
  lastName: Joi.string().min(2).max(50),
  phone: Joi.string().pattern(/^[6-9]\d{9}$/),
  businessName: Joi.string().min(2).max(100),
  companyCategory: Joi.string(),
  brandName: Joi.string().max(100),
  website: Joi.string().uri().max(200),
  supportContact: Joi.string().pattern(/^[6-9]\d{9}$/),
  supportEmail: Joi.string().email(),
  operationsEmail: Joi.string().email(),
  financeEmail: Joi.string().email()
}).min(1).messages({
  'object.min': 'At least one field must be provided for update'
});

// Document Update Schema
export const documentUpdateSchema = Joi.object({
  documentType: Joi.string().valid('gstin', 'pan', 'aadhaar', 'other').required().messages({
    'string.empty': 'Document type is required',
    'any.only': 'Invalid document type'
  }),
  documentNumber: Joi.string().when('documentType', {
    is: 'gstin',
    then: Joi.string().length(15).pattern(/^[0-9A-Z]{15}$/).required(),
    otherwise: Joi.string().optional()
  }).when('documentType', {
    is: 'pan',
    then: Joi.string().length(10).pattern(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/).required(),
    otherwise: Joi.string().optional()
  }).when('documentType', {
    is: 'aadhaar',
    then: Joi.string().length(12).pattern(/^\d{12}$/).required(),
    otherwise: Joi.string().optional()
  }),
  documentUrl: Joi.string().uri().required().messages({
    'string.empty': 'Document URL is required',
    'string.uri': 'Invalid document URL'
  }),
  documentName: Joi.string().when('documentType', {
    is: 'other',
    then: Joi.string().required(),
    otherwise: Joi.string().optional()
  })
});
