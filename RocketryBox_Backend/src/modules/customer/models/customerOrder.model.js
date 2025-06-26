import mongoose from 'mongoose';

const customerOrderSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer ID is required'],
    index: true
  },
  orderNumber: {
    type: String,
    unique: true
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'],
    default: 'pending',
    index: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true
  },
  paymentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Payment'
  },
  packageDetails: {
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
    declaredValue: {
      type: Number,
      required: [true, 'Declared value is required'],
      min: [1, 'Declared value must be at least ₹1']
    }
  },
  pickupAddress: {
    name: {
      type: String,
      required: [true, 'Pickup contact name is required']
    },
    phone: {
      type: String,
      required: [true, 'Pickup phone number is required']
    },
    email: {
      type: String
    },
    address: {
      line1: {
        type: String,
        required: [true, 'Pickup address line 1 is required']
      },
      line2: {
        type: String
      },
      city: {
        type: String,
        required: [true, 'Pickup city is required']
      },
      state: {
        type: String,
        required: [true, 'Pickup state is required']
      },
      pincode: {
        type: String,
        required: [true, 'Pickup pincode is required'],
        match: [/^\d{6}$/, 'Please provide a valid 6-digit pincode']
      },
      country: {
        type: String,
        default: 'India'
      }
    }
  },
  deliveryAddress: {
    name: {
      type: String,
      required: [true, 'Delivery contact name is required']
    },
    phone: {
      type: String,
      required: [true, 'Delivery phone number is required']
    },
    email: {
      type: String
    },
    address: {
      line1: {
        type: String,
        required: [true, 'Delivery address line 1 is required']
      },
      line2: {
        type: String
      },
      city: {
        type: String,
        required: [true, 'Delivery city is required']
      },
      state: {
        type: String,
        required: [true, 'Delivery state is required']
      },
      pincode: {
        type: String,
        required: [true, 'Delivery pincode is required'],
        match: [/^\d{6}$/, 'Please provide a valid 6-digit pincode']
      },
      country: {
        type: String,
        default: 'India'
      }
    }
  },
  selectedProvider: {
    id: {
      type: String,
      required: [true, 'Provider ID is required']
    },
    name: {
      type: String,
      required: [true, 'Provider name is required']
    },
    serviceType: {
      type: String,
      required: [true, 'Service type is required'],
      enum: ['standard', 'express', 'economy']
    },
    totalRate: {
      type: Number,
      required: [true, 'Total rate is required'],
      min: [0, 'Rate cannot be negative']
    },
    estimatedDays: {
      type: String,
      required: [true, 'Estimated delivery days is required']
    }
  },
  shippingRate: {
    type: Number,
    required: [true, 'Shipping rate is required'],
    min: [0, 'Shipping rate cannot be negative']
  },
  totalAmount: {
    type: Number,
    required: [true, 'Total amount is required'],
    min: [0, 'Total amount cannot be negative']
  },
  instructions: {
    type: String,
    maxlength: [500, 'Instructions cannot exceed 500 characters']
  },
  pickupDate: {
    type: Date,
    required: [true, 'Pickup date is required']
  },
  // AWB and tracking details (populated after payment)
  awb: {
    type: String,
    sparse: true // Allow null but unique when present
  },
  trackingId: {
    type: String,
    sparse: true // Store courier's internal tracking ID for API operations
  },
  trackingUrl: {
    type: String
  },
  courierPartner: {
    type: String
  },
  bookingType: {
    type: String,
    enum: ['API_AUTOMATED', 'MANUAL_REQUIRED']
  },
  estimatedDelivery: {
    type: Date
  },
  paidAt: {
    type: Date
  },
  // Additional fields
  notes: {
    type: String
  },
  label: {
    type: String,
    select: false // Don't include by default due to size
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, {
  timestamps: true
});

// Indexes for better query performance
customerOrderSchema.index({ customerId: 1, createdAt: -1 });
// orderNumber already has unique: true which creates an index
customerOrderSchema.index({ status: 1, paymentStatus: 1 });
// awb already has sparse: true which creates an index
// trackingId already has sparse: true which creates an index
customerOrderSchema.index({ createdAt: -1 });

// Generate order number before saving
customerOrderSchema.pre('save', async function (next) {
  // Always generate order number for new documents
  if (this.isNew) {
    try {
      let orderNumber;
      let attempts = 0;
      const maxAttempts = 5;

      do {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        orderNumber = `ORD${year}${month}${day}${random}`;

        // Check if order number already exists
        const existingOrder = await this.constructor.findOne({ orderNumber });
        if (!existingOrder) {
          this.orderNumber = orderNumber;
          break;
        }

        attempts++;
      } while (attempts < maxAttempts);

      if (!this.orderNumber) {
        throw new Error('Failed to generate unique order number after multiple attempts');
      }
    } catch (error) {
      console.error('Error generating order number:', error);
      return next(error);
    }
  }

  // Validate that orderNumber exists before saving
  if (!this.orderNumber) {
    return next(new Error('Order number is required'));
  }

  next();
});

// Calculate estimated delivery date
customerOrderSchema.pre('save', function (next) {
  if (this.isNew && this.selectedProvider.estimatedDays) {
    const days = parseInt(this.selectedProvider.estimatedDays.split('-')[1]) || 3;
    this.estimatedDelivery = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }
  next();
});

// Virtual for order age
customerOrderSchema.virtual('orderAge').get(function () {
  return Math.floor((Date.now() - this.createdAt.getTime()) / (1000 * 60 * 60 * 24));
});

// Instance method to calculate volumetric weight
customerOrderSchema.methods.calculateVolumetricWeight = function () {
  const { length, width, height } = this.packageDetails.dimensions;
  return Math.ceil((length * width * height) / 5000);
};

// Instance method to get chargeable weight
customerOrderSchema.methods.getChargeableWeight = function () {
  const volumetricWeight = this.calculateVolumetricWeight();
  return Math.max(this.packageDetails.weight, volumetricWeight);
};

// Instance method to check if order can be cancelled
customerOrderSchema.methods.canBeCancelled = function () {
  return ['pending', 'confirmed'].includes(this.status) && this.paymentStatus !== 'paid';
};

// Instance method to check if order is trackable
customerOrderSchema.methods.isTrackable = function () {
  return (this.awb || this.trackingId) && ['shipped', 'delivered'].includes(this.status);
};

// Static method to get order statistics
customerOrderSchema.statics.getOrderStats = async function (customerId, startDate, endDate) {
  const matchStage = { customerId };

  if (startDate && endDate) {
    matchStage.createdAt = {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    };
  }

  return await this.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        totalAmount: { $sum: '$totalAmount' }
      }
    }
  ]);
};

const CustomerOrder = mongoose.model('CustomerOrder', customerOrderSchema);

export default CustomerOrder;
