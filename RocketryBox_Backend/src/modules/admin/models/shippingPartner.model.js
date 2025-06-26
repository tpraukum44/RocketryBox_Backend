import mongoose from 'mongoose';

// Define zone schema
const zoneSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Zone name is required'],
    trim: true
  },
  baseRate: {
    type: Number,
    required: [true, 'Base rate is required'],
    min: 0
  },
  additionalRate: {
    type: Number,
    required: [true, 'Additional rate is required'],
    min: 0
  }
}, { _id: true });

// Define main shipping partner schema
const shippingPartnerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Partner name is required'],
    trim: true,
    index: true
  },
  logoUrl: {
    type: String,
    trim: true
  },
  apiStatus: {
    type: String,
    enum: ['active', 'inactive', 'maintenance'],
    default: 'inactive',
    index: true
  },
  performanceScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  shipmentCount: {
    type: Number,
    default: 0
  },
  deliverySuccess: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  },
  supportContact: {
    type: String,
    required: [true, 'Support contact is required'],
    trim: true
  },
  supportEmail: {
    type: String,
    required: [true, 'Support email is required'],
    trim: true,
    lowercase: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email']
  },
  apiKey: {
    type: String,
    trim: true
  },
  apiEndpoint: {
    type: String,
    trim: true
  },
  serviceTypes: [{
    type: String,
    trim: true
  }],
  serviceAreas: [{
    type: String,
    trim: true
  }],
  weightLimits: {
    min: {
      type: Number,
      required: [true, 'Minimum weight limit is required'],
      min: 0
    },
    max: {
      type: Number,
      required: [true, 'Maximum weight limit is required'],
      min: 0
    }
  },
  dimensionLimits: {
    maxLength: {
      type: Number,
      min: 0
    },
    maxWidth: {
      type: Number,
      min: 0
    },
    maxHeight: {
      type: Number,
      min: 0
    },
    maxSum: {
      type: Number,
      min: 0
    }
  },
  rates: {
    baseRate: {
      type: Number,
      required: [true, 'Base rate is required'],
      min: 0
    },
    weightRate: {
      type: Number,
      required: [true, 'Weight rate is required'],
      min: 0
    },
    dimensionalFactor: {
      type: Number,
      default: 5000
    }
  },
  zones: [zoneSchema],
  trackingUrl: {
    type: String,
    trim: true
  },
  integrationDate: {
    type: Date,
    default: Date.now
  },
  notes: {
    type: String,
    trim: true
  },
  // Performance metrics history
  performanceHistory: [{
    date: {
      type: Date,
      default: Date.now
    },
    deliverySuccess: {
      type: Number,
      min: 0,
      max: 100
    },
    onTimeDelivery: {
      type: Number,
      min: 0,
      max: 100
    },
    pickupSuccess: {
      type: Number,
      min: 0,
      max: 100
    },
    exceptionRate: {
      type: Number,
      min: 0,
      max: 100
    },
    averageDeliveryTime: {
      type: Number,
      min: 0
    },
    complaintResolutionTime: {
      type: Number,
      min: 0
    }
  }],
  // Status change history
  statusHistory: [{
    status: {
      type: String,
      enum: ['active', 'inactive', 'maintenance']
    },
    reason: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    timestamp: {
      type: Date,
      default: Date.now
    }
  }]
}, {
  timestamps: true
});

// Create compound indexes for performance
shippingPartnerSchema.index({ name: 1, apiStatus: 1 });
shippingPartnerSchema.index({ performanceScore: -1, shipmentCount: -1 });

const ShippingPartner = mongoose.model('ShippingPartner', shippingPartnerSchema);

export default ShippingPartner; 