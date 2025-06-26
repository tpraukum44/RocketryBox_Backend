import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import { generateUserId } from '../../../utils/userIdGenerator.js';

const addressSchema = new mongoose.Schema({
  address1: { type: String },
  address2: { type: String },
  city: { type: String },
  state: { type: String },
  pincode: { type: String },
  country: { type: String, default: 'India' }
}, { _id: false });

const bankDetailsSchema = new mongoose.Schema({
  accountType: { type: String },
  bankName: { type: String },
  accountNumber: { type: String },
  accountHolderName: { type: String },
  branchName: { type: String },
  ifscCode: { type: String },
  cancelledCheque: {
    url: { type: String },
    status: { type: String, enum: ['verified', 'pending', 'rejected'], default: 'pending' }
  }
}, { _id: false });

const sellerSchema = new mongoose.Schema({
  // RB User ID (short, readable ID)
  rbUserId: {
    type: String,
    unique: true,
    index: true,
    // Will be auto-generated in pre-save hook
  },
  // Basic Info
  name: { type: String, required: true, index: true },
  firstName: { type: String },  // For display purposes
  lastName: { type: String },   // For display purposes
  email: { type: String, required: true, unique: true, lowercase: true, index: true },
  phone: { type: String, required: true, unique: true, index: true },
  password: { type: String, required: true, select: false },

  // Business Info
  businessName: { type: String, required: true, index: true },
  companyCategory: { type: String },
  brandName: { type: String },
  website: { type: String },
  monthlyShipments: { type: String, enum: ['0-100', '101-500', '501-1000', '1001-5000', '5000+'] },

  // Contact Info
  supportContact: { type: String },
  supportEmail: { type: String },
  operationsEmail: { type: String },
  financeEmail: { type: String },

  // Store Links
  storeLinks: {
    website: { type: String },
    amazon: { type: String },
    shopify: { type: String },
    opencart: { type: String }
  },

  // Shopify Integration
  shopifyIntegration: {
    shop: { type: String }, // The shopify store domain
    accessToken: { type: String }, // OAuth access token
    webhookId: { type: String }, // Webhook ID for order creation
    isActive: { type: Boolean, default: false },
    connectedAt: { type: Date },
    lastSync: { type: Date }
  },

  // Address
  address: addressSchema,

  // Documents
  gstin: { type: String },
  documents: {
    gstin: {
      number: { type: String },
      url: { type: String },
      status: { type: String, enum: ['verified', 'pending', 'rejected'], default: 'pending' }
    },
    pan: {
      number: { type: String },
      url: { type: String },
      status: { type: String, enum: ['verified', 'pending', 'rejected'], default: 'pending' }
    },
    aadhaar: {
      number: { type: String },
      url: { type: String },
      status: { type: String, enum: ['verified', 'pending', 'rejected'], default: 'pending' }
    },
    others: [{
      name: { type: String },
      type: { type: String },
      url: { type: String },
      status: { type: String, enum: ['verified', 'pending', 'rejected'], default: 'pending' }
    }]
  },

  // Bank Details
  bankDetails: bankDetailsSchema,

  // System Fields
  status: { type: String, enum: ['pending', 'active', 'suspended'], default: 'pending', index: true },
  kycVerified: { type: Boolean, default: false, index: true },
  statusHistory: [{
    status: { type: String, enum: ['pending', 'active', 'suspended'] },
    reason: { type: String },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    timestamp: { type: Date, default: Date.now }
  }],
  otp: {
    code: { type: String },
    expiresAt: { type: Date }
  },
  lastLogin: { type: Date },
  lastActive: { type: Date, default: Date.now, index: true },
  refreshToken: { type: String, select: false },
  walletBalance: { type: String, default: '0' },
  rateCard: { type: mongoose.Schema.Types.ObjectId, ref: 'RateCard', default: null },

  // Rate Band (Admin assignable) - RBX1 is the default for all sellers
  rateBand: { type: String, default: null }, // null means use default RBX1

  // Payment and Credit Settings (Admin controlled)
  paymentType: { type: String, enum: ['wallet', 'credit'], default: 'wallet' },
  creditLimit: { type: Number, default: 0 },
  creditPeriod: { type: Number, default: 0 }, // in days

  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Add compound indexes for common query patterns
sellerSchema.index({ status: 1, lastActive: -1 });
sellerSchema.index({ businessName: 'text', email: 'text', phone: 'text' });

// Default filter to exclude suspended sellers
sellerSchema.pre(/^find/, function (next) {
  // Check if this query should skip the default filter
  const skipDefaultFilter = this.getOptions().skipDefaultFilter;

  // Apply default filter for normal queries
  if (!skipDefaultFilter && !this._conditions.status) {
    this.find({ status: { $ne: 'suspended' } });
  }
  next();
});

// Update lastActive and timestamps
sellerSchema.pre('save', function (next) {
  if (this.isModified('lastLogin')) {
    this.lastActive = new Date();
  }
  this.updatedAt = new Date();
  next();
});

// Auto-activate seller when all documents are verified
sellerSchema.pre('save', function (next) {
  // Only check if documents were modified
  if (this.isModified('documents') || this.isModified('kycVerified')) {

    // Check if all required documents are verified
    const hasVerifiedGST = this.documents?.gstin?.status === 'verified';
    const hasVerifiedPAN = this.documents?.pan?.status === 'verified';
    const hasVerifiedAadhaar = this.documents?.aadhaar?.status === 'verified';

    const allDocumentsVerified = hasVerifiedGST && hasVerifiedPAN && hasVerifiedAadhaar;

    // Auto-activate if all documents are verified and currently pending
    if (allDocumentsVerified && this.status === 'pending') {
      this.status = 'active';
      this.kycVerified = true;

      // Add status history
      if (!this.statusHistory) {
        this.statusHistory = [];
      }

      this.statusHistory.push({
        status: 'active',
        reason: 'Auto-activated: All required documents verified',
        updatedBy: null, // System update
        timestamp: new Date()
      });
    }

    // Auto-deactivate if documents become unverified
    else if (!allDocumentsVerified && this.status === 'active' && this.kycVerified) {
      this.status = 'pending';
      this.kycVerified = false;

      // Add status history
      if (!this.statusHistory) {
        this.statusHistory = [];
      }

      this.statusHistory.push({
        status: 'pending',
        reason: 'Auto-pending: Document verification status changed',
        updatedBy: null, // System update
        timestamp: new Date()
      });
    }
  }

  next();
});

// Hash password before save
sellerSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }

    this.password = await bcrypt.hash(this.password, 10);
    next();
  } catch (error) {
    next(error);
  }
});

// Auto-generate RB User ID for new sellers
sellerSchema.pre('save', async function (next) {
  // Only generate for new documents
  if (this.isNew && !this.rbUserId) {
    try {
      this.rbUserId = await generateUserId('seller');
    } catch (error) {
      // Continue without blocking save - user can function without RB ID
    }
  }
  next();
});

// Compare password
sellerSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT
sellerSchema.methods.generateAuthToken = function () {
  return jwt.sign({ id: this._id, role: 'seller' }, process.env.JWT_SECRET, {
    expiresIn: '7d' // 7 days - hardcoded for seller tokens
  });
};

// Generate Refresh Token
sellerSchema.methods.generateRefreshToken = function () {
  return jwt.sign({ id: this._id, role: 'seller' }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: '30d' // 30 days - hardcoded for refresh tokens
  });
};

// Remove sensitive data
sellerSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

// Static method to find a seller by ID safely
sellerSchema.statics.findByIdSafe = async function (id) {
  try {
    return await this.findById(id).lean();
  } catch (error) {
    return null;
  }
};

// Helper method for updating seller data safely
sellerSchema.methods.updateSafe = async function (updates) {
  const allowedFields = [
    'name', 'firstName', 'lastName', 'phone', 'businessName',
    'companyCategory', 'brandName', 'website', 'monthlyShipments',
    'supportContact', 'supportEmail', 'operationsEmail', 'financeEmail',
    'address', 'documents', 'bankDetails', 'storeLinks',
    // Admin-controlled fields
    'rateBand', 'paymentType', 'creditLimit', 'creditPeriod'
  ];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      this[key] = updates[key];
    }
  });

  this.lastActive = new Date();
  this.updatedAt = new Date();
  return await this.save();
};

export default mongoose.model('Seller', sellerSchema);
