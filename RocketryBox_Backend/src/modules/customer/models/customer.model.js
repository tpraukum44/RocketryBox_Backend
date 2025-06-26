import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { generateUserId } from '../../../utils/userIdGenerator.js';

const addressSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Name is required']
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required']
  },
  address1: {
    type: String,
    required: [true, 'Address line 1 is required']
  },
  address2: String,
  city: {
    type: String,
    required: [true, 'City is required']
  },
  state: {
    type: String,
    required: [true, 'State is required']
  },
  pincode: {
    type: String,
    required: [true, 'Pincode is required']
  },
  country: {
    type: String,
    required: [true, 'Country is required'],
    default: 'India'
  },
  isDefault: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

const customerSchema = new mongoose.Schema({
  rbUserId: {
    type: String,
    unique: true,
    index: true,
    // Will be auto-generated in pre-save hook
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true,
    index: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  mobile: {
    type: String,
    required: [true, 'Mobile number is required'],
    sparse: true,  // Only create unique index for non-null values
    unique: true,
    index: true
  },
  phone: {
    type: String,
    sparse: true,  // Only create unique index for non-null values
    unique: true,
    index: true
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters long'],
    select: false
  },
  passwordResetToken: {
    type: String,
    select: false
  },
  passwordResetTokenExpiry: {
    type: Date,
    select: false
  },
  profileImage: {
    type: String,
    default: null
  },
  addresses: [addressSchema],
  preferences: {
    language: {
      type: String,
      default: 'en'
    },
    currency: {
      type: String,
      default: 'INR'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: true
      },
      push: {
        type: Boolean,
        default: true
      }
    }
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  isPhoneVerified: {
    type: Boolean,
    default: false
  },
  lastLogin: Date,
  lastActive: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
    index: true
  }
}, {
  timestamps: true
});

// Add compound indexes for common query patterns
customerSchema.index({ status: 1, lastActive: -1 });
customerSchema.index({ name: 'text', email: 'text', mobile: 'text' });

// Default filter to exclude inactive and suspended customers
customerSchema.pre(/^find/, function (next) {
  // Check if this query should skip the default filter
  const skipDefaultFilter = this.getOptions().skipDefaultFilter;

  // Apply default filter for normal queries only if:
  // 1. skipDefaultFilter is not set to true
  // 2. status is not already specified in the query
  // 3. This is not an admin query (indicated by skipDefaultFilter)
  if (!skipDefaultFilter && !this._conditions.status && !this.getQuery().status) {
    this.find({ status: 'active' });
  }
  next();
});

// Also handle countDocuments and other operations
customerSchema.pre(['countDocuments', 'count'], function (next) {
  const skipDefaultFilter = this.getOptions().skipDefaultFilter;

  if (!skipDefaultFilter && !this._conditions.status && !this.getQuery().status) {
    this.find({ status: 'active' });
  }
  next();
});

// Update lastActive field for login operations
customerSchema.pre('save', function (next) {
  if (this.isModified('lastLogin')) {
    this.lastActive = new Date();
  }
  next();
});

// Hash password before saving
customerSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Auto-generate RB User ID for new customers
customerSchema.pre('save', async function (next) {
  // Only generate for new documents
  if (this.isNew && !this.rbUserId) {
    try {
      this.rbUserId = await generateUserId('customer');
    } catch (error) {
      console.error('Error generating RB User ID for customer:', error);
      // Continue without blocking save - user can function without RB ID
    }
  }
  next();
});

// Compare password method
customerSchema.methods.comparePassword = async function (candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Generate JWT token
customerSchema.methods.generateAuthToken = function (rememberMe = false) {
  const expiresIn = rememberMe ? '30d' : '1d'; // Hardcoded values: 30 days for remembered, 1 day for normal
  return jwt.sign(
    { id: this._id, role: 'customer' },
    process.env.JWT_SECRET,
    { expiresIn }
  );
};

// Generate refresh token
customerSchema.methods.generateRefreshToken = function (rememberMe = false) {
  const expiresIn = rememberMe ? '60d' : (process.env.JWT_REFRESH_EXPIRES_IN || '7d');
  return jwt.sign(
    { id: this._id, role: 'customer' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn }
  );
};

// Remove sensitive data when converting to JSON
customerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.__v;
  return obj;
};

// Static method to find a customer by ID safely
customerSchema.statics.findByIdSafe = async function (id) {
  try {
    return await this.findById(id).lean();
  } catch (error) {
    return null;
  }
};

// Helper method for updating customer data safely
customerSchema.methods.updateSafe = async function (updates) {
  const allowedFields = [
    'name', 'mobile', 'preferences', 'addresses'
  ];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      this[key] = updates[key];
    }
  });

  this.lastActive = new Date();
  return await this.save();
};

const Customer = mongoose.model('Customer', customerSchema);

export default Customer;
