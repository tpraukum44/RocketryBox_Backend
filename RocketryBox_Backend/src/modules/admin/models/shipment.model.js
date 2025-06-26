import mongoose from 'mongoose';

const shipmentTrackingSchema = new mongoose.Schema({
  status: String,
  location: String,
  timestamp: { type: Date, default: Date.now },
  description: String
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
  // Reference to original seller shipment
  originalShipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellerShipment',
    required: true,
    index: true
  },
  // Order reference
  order: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'orderModel',
    required: true,
    index: true
  },
  // Type of order (seller or customer)
  orderModel: {
    type: String,
    enum: ['SellerOrder', 'CustomerOrder'],
    required: true
  },
  // Seller information
  seller: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Seller',
      required: true,
      index: true
    },
    name: String,
    email: String,
    phone: String,
    businessName: String
  },
  // Customer information
  customer: {
    name: String,
    email: String,
    phone: String
  },
  // Shipping details
  awb: {
    type: String,
    required: true,
    index: true
  },
  courier: {
    type: String,
    required: true,
    index: true
  },
  partnerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ShippingPartner',
    index: true
  },
  status: {
    type: String,
    enum: ['Booked', 'In-transit', 'Delivered', 'Pending Pickup', 'Cancelled', 'Exception', 'Returned', 'NDR'],
    default: 'Booked',
    index: true
  },
  pickupDate: Date,
  deliveryDate: Date,
  expectedDeliveryDate: Date,
  // Shipment details
  weight: String,
  dimensions: {
    length: Number,
    width: Number,
    height: Number
  },
  volumetricWeight: Number,
  // Cost details
  shippingCharge: {
    type: Number,
    default: 0
  },
  codAmount: {
    type: Number,
    default: 0
  },
  isCod: {
    type: Boolean,
    default: false
  },
  // Address information
  pickupAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  deliveryAddress: {
    street: String,
    city: String,
    state: String,
    pincode: String,
    country: String
  },
  // Tracking
  trackingHistory: [shipmentTrackingSchema],
  trackingUrl: String,
  channel: {
    type: String,
    enum: ['MANUAL', 'EXCEL', 'SHOPIFY', 'WOOCOMMERCE', 'AMAZON', 'FLIPKART', 'OPENCART', 'API', 'ADMIN'],
    default: 'MANUAL'
  },
  // Issue tracking
  issues: [{
    type: {
      type: String,
      enum: ['NDR', 'Delay', 'Damage', 'Lost', 'Other']
    },
    description: String,
    reportedAt: { type: Date, default: Date.now },
    resolvedAt: Date,
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
      default: 'Open'
    },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    resolution: String,
    customerNotified: {
      type: Boolean,
      default: false
    },
    sellerNotified: {
      type: Boolean,
      default: false
    }
  }],
  // Statistics for analytics
  transitTime: Number, // in hours
  deliveryAttempts: {
    type: Number,
    default: 0
  },
  tags: [String],
  // Audit
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  lastSyncAt: {
    type: Date,
    default: Date.now
  },
  lastSyncedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Create indexes
shipmentSchema.index({ awb: 1, courier: 1 }, { unique: true });
shipmentSchema.index({ status: 1, createdAt: -1 });
shipmentSchema.index({ 'seller.id': 1, status: 1 });
shipmentSchema.index({ 'customer.phone': 1 });
shipmentSchema.index({ 'customer.email': 1 });

// Create an aggregated view by courier for dashboard metrics
shipmentSchema.statics.getShipmentStatsByCourier = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$courier',
        total: { $sum: 1 },
        delivered: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0]
          }
        },
        inTransit: {
          $sum: {
            $cond: [{ $eq: ['$status', 'In-transit'] }, 1, 0]
          }
        },
        exceptions: {
          $sum: {
            $cond: [
              { $in: ['$status', ['Exception', 'NDR', 'Cancelled', 'Returned']] },
              1,
              0
            ]
          }
        },
        averageTransitTime: { $avg: '$transitTime' }
      }
    },
    {
      $project: {
        courier: '$_id',
        total: 1,
        delivered: 1,
        inTransit: 1,
        exceptions: 1,
        successRate: {
          $multiply: [
            { $divide: ['$delivered', { $max: ['$total', 1] }] },
            100
          ]
        },
        averageTransitTime: 1,
        _id: 0
      }
    }
  ]);
};

// Get daily shipment counts for time-series analysis
shipmentSchema.statics.getDailyShipmentCounts = async function(startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        createdAt: {
          $gte: startDate,
          $lte: endDate
        }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: '$_id.date',
        statuses: {
          $push: {
            status: '$_id.status',
            count: '$count'
          }
        },
        total: { $sum: '$count' }
      }
    },
    {
      $sort: { _id: 1 }
    },
    {
      $project: {
        date: '$_id',
        statuses: 1,
        total: 1,
        _id: 0
      }
    }
  ]);
};

const AdminShipment = mongoose.model('AdminShipment', shipmentSchema);

export default AdminShipment; 