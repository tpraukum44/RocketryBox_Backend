import mongoose from 'mongoose';

// Common schema for all escalation types
const escalationBaseSchema = {
  // Reference ID related to this escalation (order ID, pickup ID, etc.)
  referenceId: {
    type: String,
    required: true,
    index: true
  },
  
  // Escalation description
  description: {
    type: String,
    required: true
  },
  
  // Current status
  status: {
    type: String,
    enum: ['Pending', 'In Progress', 'Resolved', 'Closed', 'Re-opened'],
    default: 'Pending',
    index: true
  },
  
  // Status history for tracking changes
  statusHistory: [{
    status: String,
    updatedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      name: String,
      role: String
    },
    timestamp: { type: Date, default: Date.now },
    remarks: String
  }],
  
  // Priority level
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
    index: true
  },
  
  // Comments/notes added to this escalation
  comments: [{
    comment: {
      type: String,
      required: true
    },
    addedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      name: String,
      role: String
    },
    timestamp: { type: Date, default: Date.now }
  }],
  
  // Admin assigned to handle this escalation
  assignedTo: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    name: String,
    role: String
  },
  
  // Category for grouping similar escalations
  category: {
    type: String,
    required: true,
    index: true
  },
  
  // Seller involved in this escalation (if applicable)
  seller: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', index: true },
    name: String,
    businessName: String,
    email: String,
    phone: String
  },
  
  // Customer involved in this escalation (if applicable)
  customer: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    name: String,
    email: String,
    phone: String
  },
  
  // Resolution details when escalation is resolved
  resolution: {
    resolvedBy: {
      id: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
      name: String,
      role: String
    },
    resolvedAt: Date,
    resolution: String,
    actionTaken: String
  },
  
  // Due date for this escalation to be handled
  dueDate: {
    type: Date,
    index: true
  },
  
  // Flag to mark urgent or high priority escalations
  isUrgent: {
    type: Boolean,
    default: false,
    index: true
  },
  
  // Type of escalation
  escalationType: {
    type: String,
    enum: ['Pickup', 'Shipment', 'Billing', 'Weight', 'Tech'],
    required: true,
    index: true
  }
};

// Pickup escalation schema
const pickupEscalationSchema = new mongoose.Schema({
  ...escalationBaseSchema,
  
  // Pickup specific fields
  pickup: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Pickup' },
    pickupId: String,
    location: String,
    scheduledDate: Date,
    courierPartner: String
  }
}, { timestamps: true });

// Shipment escalation schema
const shipmentEscalationSchema = new mongoose.Schema({
  ...escalationBaseSchema,
  
  // Shipment specific fields
  shipment: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'AdminShipment' },
    orderId: String,
    orderDate: String,
    bookedDate: String,
    pickupId: String,
    product: String,
    amount: String,
    paymentType: {
      type: String,
      enum: ['COD', 'Prepaid']
    },
    weight: String,
    channel: String,
    awb: String,
    courier: String
  }
}, { timestamps: true });

// Billing escalation schema
const billingEscalationSchema = new mongoose.Schema({
  ...escalationBaseSchema,
  
  // Billing specific fields
  billing: {
    remittanceId: String,
    status: {
      type: String,
      enum: ['Pending', 'Completed', 'Failed', 'Overdue']
    },
    paymentDate: Date,
    remittanceAmount: String,
    freightDeduction: String,
    convenienceFee: String,
    total: String,
    paymentRef: String
  }
}, { timestamps: true });

// Weight issue escalation schema
const weightEscalationSchema = new mongoose.Schema({
  ...escalationBaseSchema,
  
  // Weight issue specific fields
  weightIssue: {
    issueId: String,
    declaredWeight: String,
    measuredWeight: String,
    weightDifference: String,
    chargeableDifference: String,
    evidenceUrl: String
  }
}, { timestamps: true });

// Tech issue escalation schema
const techEscalationSchema = new mongoose.Schema({
  ...escalationBaseSchema,
  
  // Tech issue specific fields
  techIssue: {
    escId: String,
    escTime: String,
    escCloseDate: String,
    platform: String,
    browser: String,
    device: String,
    reproducibleSteps: [String],
    errorMessage: String,
    screenshotUrl: String
  }
}, { timestamps: true });

// Create indexes for common fields across all schemas
[
  pickupEscalationSchema,
  shipmentEscalationSchema,
  billingEscalationSchema,
  weightEscalationSchema,
  techEscalationSchema
].forEach(schema => {
  // Create compound indexes for faster searching
  schema.index({ status: 1, createdAt: -1 });
  schema.index({ priority: 1, status: 1 });
  schema.index({ 'seller.id': 1, status: 1 });
  schema.index({ escalationType: 1, status: 1 });
  schema.index({ escalationType: 1, 'seller.id': 1 });
  schema.index({ isUrgent: 1, dueDate: 1 });
  
  // Add static methods to each schema
  schema.statics.getEscalationStats = async function() {
    return this.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);
  };
  
  schema.statics.getEscalationsByCategory = async function() {
    return this.aggregate([
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 },
          resolved: {
            $sum: {
              $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0]
            }
          }
        }
      },
      {
        $project: {
          category: '$_id',
          count: 1,
          resolved: 1,
          _id: 0,
          resolutionRate: {
            $multiply: [
              { $divide: ['$resolved', { $max: ['$count', 1] }] },
              100
            ]
          }
        }
      }
    ]);
  };
  
  schema.statics.getPriorityStats = async function() {
    return this.aggregate([
      {
        $group: {
          _id: '$priority',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          priority: '$_id',
          count: 1,
          _id: 0
        }
      },
      {
        $sort: { 
          priority: 1
        }
      }
    ]);
  };
  
  schema.statics.getRecentEscalations = async function(limit = 10) {
    return this.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  };
});

// Create models from schemas
const PickupEscalation = mongoose.model('PickupEscalation', pickupEscalationSchema);
const ShipmentEscalation = mongoose.model('ShipmentEscalation', shipmentEscalationSchema);
const BillingEscalation = mongoose.model('BillingEscalation', billingEscalationSchema);
const WeightEscalation = mongoose.model('WeightEscalation', weightEscalationSchema);
const TechEscalation = mongoose.model('TechEscalation', techEscalationSchema);

// Export all models
export {
  PickupEscalation,
  ShipmentEscalation,
  BillingEscalation,
  WeightEscalation,
  TechEscalation
}; 