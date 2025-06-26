import mongoose from 'mongoose';

const attemptHistorySchema = new mongoose.Schema({
  date: String,
  time: String,
  status: String,
  reason: String,
  agentRemarks: String,
  addedBy: {
    id: { type: mongoose.Schema.Types.ObjectId, refPath: 'addedByModel' },
    name: String,
    role: String
  },
  addedByModel: {
    type: String,
    enum: ['Admin', 'Seller', 'System']
  }
}, { _id: true, timestamps: true });

const productSchema = new mongoose.Schema({
  name: String,
  sku: String,
  quantity: Number,
  price: Number,
  image: String
}, { _id: false });

const commentSchema = new mongoose.Schema({
  comment: {
    type: String,
    required: true
  },
  addedBy: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    name: String,
    role: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

const adminNdrSchema = new mongoose.Schema({
  // Reference to original seller NDR
  originalNDR: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NDR',
    required: true,
    index: true
  },
  // Order reference
  orderId: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'orderModel', 
    required: true,
    index: true
  },
  orderModel: {
    type: String,
    enum: ['SellerOrder', 'CustomerOrder'],
    required: true
  },
  // Shipment reference
  shipmentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'shipmentModel',
    required: true,
    index: true
  },
  shipmentModel: {
    type: String,
    enum: ['SellerShipment', 'AdminShipment'],
    required: true
  },
  awb: { 
    type: String, 
    required: true,
    index: true
  },
  customer: {
    name: String,
    phone: String,
    email: String,
    address: {
      fullName: String,
      contactNumber: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      pincode: String,
      city: String,
      state: String
    }
  },
  seller: {
    id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Seller',
      index: true
    },
    name: String,
    contact: String,
    business: String,
    email: String
  },
  courier: {
    name: String,
    trackingUrl: String,
    partnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ShippingPartner'
    }
  },
  attempts: { 
    type: Number, 
    default: 1 
  },
  attemptHistory: [attemptHistorySchema],
  status: { 
    type: String, 
    enum: ['Pending', 'In Progress', 'Resolved', 'RTO Initiated', 'RTO Completed'], 
    default: 'Pending',
    index: true
  },
  statusHistory: [{
    status: String,
    updatedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      name: String,
      role: String
    },
    reason: String,
    timestamp: { type: Date, default: Date.now }
  }],
  actionTaken: {
    type: String,
    enum: ['None', 'Customer Contacted', 'Address Updated', 'Delivery Rescheduled', 'RTO Initiated', 'Other'],
    default: 'None'
  },
  reason: String,
  reasonCategory: {
    type: String,
    enum: ['Customer Not Available', 'Address Issues', 'Delivery Issues', 'Customer Refusal'],
    index: true
  },
  recommendedAction: String,
  currentLocation: {
    lat: Number,
    lng: Number
  },
  products: [productSchema],
  comments: [commentSchema],
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
    index: true
  },
  assignedTo: {
    id: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Admin',
      index: true
    },
    name: String,
    role: String
  },
  rtoDetails: {
    initiatedDate: Date,
    reason: String,
    awb: String,
    status: String,
    completedDate: Date,
    trackingUrl: String
  },
  nextActionDate: {
    type: Date,
    index: true
  },
  attemptedContact: {
    type: Boolean,
    default: false
  },
  contactHistory: [{
    method: {
      type: String,
      enum: ['Phone', 'SMS', 'Email', 'WhatsApp']
    },
    timestamp: Date,
    status: {
      type: String,
      enum: ['Success', 'Failed', 'No Response']
    },
    notes: String
  }],
  resolution: {
    type: String,
    enum: ['Delivered', 'Returned', 'Cancelled', 'Lost', 'Damaged']
  },
  resolutionDate: Date,
  lastSyncAt: {
    type: Date,
    default: Date.now
  },
  lastSyncedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  createdAt: { 
    type: Date, 
    default: Date.now,
    index: true
  },
  updatedAt: { 
    type: Date, 
    default: Date.now 
  }
}, { timestamps: true });

// Create indexes for efficient queries
adminNdrSchema.index({ awb: 1, courier: 1 });
adminNdrSchema.index({ status: 1, createdAt: -1 });
adminNdrSchema.index({ 'seller.id': 1, status: 1 });
adminNdrSchema.index({ 'customer.phone': 1 });
adminNdrSchema.index({ 'customer.email': 1 });

// Define static methods for analytics
adminNdrSchema.statics.getNDRStatsByCourier = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$courier.name',
        total: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0]
          }
        },
        rtoInitiated: {
          $sum: {
            $cond: [
              { $in: ['$status', ['RTO Initiated', 'RTO Completed']] },
              1,
              0
            ]
          }
        },
        avgAttempts: { $avg: '$attempts' }
      }
    },
    {
      $project: {
        courier: '$_id',
        total: 1,
        resolved: 1,
        rtoInitiated: 1,
        resolutionRate: {
          $multiply: [
            { $divide: ['$resolved', { $max: ['$total', 1] }] },
            100
          ]
        },
        avgAttempts: 1,
        _id: 0
      }
    }
  ]);
};

adminNdrSchema.statics.getNDRStatsByReasonCategory = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$reasonCategory',
        count: { $sum: 1 },
        resolvedCount: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0]
          }
        },
        rtoCount: {
          $sum: {
            $cond: [
              { $in: ['$status', ['RTO Initiated', 'RTO Completed']] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $project: {
        category: '$_id',
        count: 1,
        resolvedCount: 1,
        rtoCount: 1,
        resolutionRate: {
          $multiply: [
            { $divide: ['$resolvedCount', { $max: ['$count', 1] }] },
            100
          ]
        },
        _id: 0
      }
    },
    {
      $sort: { count: -1 }
    }
  ]);
};

// Get NDRs by date range
adminNdrSchema.statics.getNDRsByDateRange = async function(startDate, endDate) {
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
          date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }
        },
        count: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0]
          }
        },
        rtoInitiated: {
          $sum: {
            $cond: [
              { $in: ['$status', ['RTO Initiated', 'RTO Completed']] },
              1,
              0
            ]
          }
        }
      }
    },
    {
      $sort: { '_id.date': 1 }
    }
  ]);
};

const AdminNDR = mongoose.model('AdminNDR', adminNdrSchema);

export default AdminNDR; 