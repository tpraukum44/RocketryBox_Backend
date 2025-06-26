import mongoose from 'mongoose';

const packageItemSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Item name is required']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  value: {
    type: Number,
    required: [true, 'Value is required'],
    min: [0, 'Value cannot be negative']
  }
});

const orderSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true,
    index: true
  },
  awb: {
    type: String,
    required: false, // AWB comes from courier APIs only, not generated
    unique: true,
    sparse: true, // Allow multiple null values
    index: true
  },
  status: {
    type: String,
    enum: ['Booked', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled'],
    default: 'Booked',
    index: true
  },
  pickupAddress: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    address1: {
      type: String,
      required: true
    },
    address2: String,
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'India'
    }
  },
  deliveryAddress: {
    name: {
      type: String,
      required: true
    },
    phone: {
      type: String,
      required: true
    },
    address1: {
      type: String,
      required: true
    },
    address2: String,
    city: {
      type: String,
      required: true
    },
    state: {
      type: String,
      required: true
    },
    pincode: {
      type: String,
      required: true
    },
    country: {
      type: String,
      required: true,
      default: 'India'
    }
  },
  package: {
    weight: {
      type: Number,
      required: [true, 'Weight is required'],
      min: [0.1, 'Weight must be at least 0.1 kg']
    },
    dimensions: {
      length: {
        type: Number,
        required: [true, 'Length is required'],
        min: [1, 'Length must be at least 1 cm']
      },
      width: {
        type: Number,
        required: [true, 'Width is required'],
        min: [1, 'Width must be at least 1 cm']
      },
      height: {
        type: Number,
        required: [true, 'Height is required'],
        min: [1, 'Height must be at least 1 cm']
      }
    },
    items: [packageItemSchema]
  },
  serviceType: {
    type: String,
    enum: ['standard', 'express', 'cod'],
    required: true,
    index: true
  },
  paymentMethod: {
    type: String,
    required: true,
    index: true
  },
  paymentId: {
    type: String,
    select: false
  },
  amount: {
    type: Number,
    required: true,
    min: [0, 'Amount cannot be negative']
  },
  estimatedDelivery: {
    type: Date,
    required: true
  },
  tracking: {
    status: String,
    currentLocation: String,
    timeline: [{
      status: String,
      location: String,
      timestamp: Date,
      description: String,
      code: String
    }]
  },
  courier: {
    name: String,
    trackingUrl: String,
    phone: String
  },
  instructions: String,
  pickupDate: {
    type: Date,
    required: true
  },
  label: {
    type: String,
    select: false
  },
  refund: {
    id: String,
    amount: Number,
    status: String,
    createdAt: Date
  }
}, {
  timestamps: true
});

// Add compound indexes for common query patterns
orderSchema.index({ customer: 1, status: 1 });
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ status: 1, estimatedDelivery: 1 });
orderSchema.index({ createdAt: -1 });

// Filter out cancelled orders by default
orderSchema.pre(/^find/, function (next) {
  // Skip the default filter if explicitly requested
  const skipDefaultFilter = this.getOptions().skipDefaultFilter;

  if (!skipDefaultFilter && !this._conditions.status) {
    this.find({ status: { $ne: 'Cancelled' } });
  }
  next();
});

// Helper method to update order status safely
orderSchema.methods.updateStatus = async function (status, description = null) {
  const validStatuses = ['Booked', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled'];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  this.status = status;

  // Update tracking timeline
  if (!this.tracking) {
    this.tracking = {
      status,
      timeline: []
    };
  }

  this.tracking.status = status;
  this.tracking.timeline.push({
    status,
    timestamp: new Date(),
    description: description || `Order ${status.toLowerCase()}`
  });

  return await this.save();
};

// Helper method to get order details in standardized format
orderSchema.methods.getOrderDetails = function () {
  return {
    id: this._id,
    awb: this.awb,
    customer: this.customer,
    status: this.status,
    amount: this.amount,
    serviceType: this.serviceType,
    createdAt: this.createdAt,
    estimatedDelivery: this.estimatedDelivery,
    tracking: this.tracking,
    courier: this.courier
  };
};

// Calculate volumetric weight
orderSchema.methods.calculateVolumetricWeight = function () {
  const { length, width, height } = this.package.dimensions;
  return (length * width * height) / 5000; // Standard volumetric weight calculation
};

// Get order status timeline
orderSchema.methods.getStatusTimeline = function () {
  return this.tracking.timeline.sort((a, b) => b.timestamp - a.timestamp);
};

const Order = mongoose.model('Order', orderSchema, 'customerorders');

export default Order;
