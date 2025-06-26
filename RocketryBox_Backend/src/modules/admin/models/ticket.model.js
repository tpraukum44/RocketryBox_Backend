import mongoose from 'mongoose';

// Schema for ticket attachments
const attachmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  url: {
    type: String,
    required: true
  },
  type: String,
  size: Number
}, { _id: false });

// Schema for ticket responses
const responseSchema = new mongoose.Schema({
  message: {
    type: String,
    required: true
  },
  sender: {
    type: String,
    enum: ['admin', 'customer', 'seller'],
    required: true
  },
  attachments: [attachmentSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

// Main ticket schema
const ticketSchema = new mongoose.Schema({
  ticketId: {
    type: String,
    unique: true
  },
  subject: {
    type: String,
    required: true
  },
  category: {
    type: String,
    enum: ['ORDER', 'PICKUP', 'BILLING', 'REMITTANCE', 'WT_DISPUTE', 'TECH', 'CALLBACK', 'KYC', 'FINANCE'],
    required: true,
    index: true
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium',
    index: true
  },
  status: {
    type: String,
    enum: ['New', 'In Progress', 'Resolved', 'Closed'],
    default: 'New',
    index: true
  },
  customer: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'customerModel',
      required: true,
      index: true
    },
    name: String,
    email: String,
    phone: String,
    type: {
      type: String,
      enum: ['seller', 'customer'],
      required: true
    }
  },
  customerModel: {
    type: String,
    enum: ['Seller', 'Customer'],
    required: true
  },
  details: {
    type: String,
    required: true
  },
  attachments: [attachmentSchema],
  assignedTo: {
    id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      index: true
    },
    name: String,
    role: String
  },
  relatedEntities: {
    order: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'orderModel',
      index: true
    },
    orderModel: {
      type: String,
      enum: ['SellerOrder', 'CustomerOrder']
    },
    shipment: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: 'shipmentModel',
      index: true
    },
    shipmentModel: {
      type: String,
      enum: ['SellerShipment', 'AdminShipment']
    }
  },
  responses: [responseSchema],
  tags: [String],
  firstResponseTime: Number, // Time in minutes to first response
  resolutionTime: Number, // Time in minutes to resolution
  sla: {
    dueDate: Date,
    breached: {
      type: Boolean,
      default: false
    }
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

// Generate unique ticket ID before saving
ticketSchema.pre('save', async function(next) {
  if (!this.isNew) return next();

  try {
    // Format: TKT-YYMM-XXXX where XXXX is an incremental number
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const prefix = `TKT-${year}${month}-`;
    
    // Find the highest existing ticket number for this month
    const latestTicket = await this.constructor.findOne({
      ticketId: new RegExp(`^${prefix}`)
    }).sort({ ticketId: -1 });
    
    let ticketNumber = 1;
    if (latestTicket && latestTicket.ticketId) {
      const lastNumber = parseInt(latestTicket.ticketId.split('-')[2], 10);
      if (!isNaN(lastNumber)) {
        ticketNumber = lastNumber + 1;
      }
    }
    
    this.ticketId = `${prefix}${ticketNumber.toString().padStart(4, '0')}`;
    next();
  } catch (error) {
    next(error);
  }
});

// Add indexes for efficient queries
ticketSchema.index({ status: 1, priority: 1, createdAt: -1 });
ticketSchema.index({ 'customer.email': 1 });
ticketSchema.index({ 'customer.phone': 1 });

// Define static methods for analytics
ticketSchema.statics.getTicketStats = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$status',
        count: { $sum: 1 },
        avgResolutionTime: { 
          $avg: {
            $cond: [
              { $ne: ['$resolutionTime', null] },
              '$resolutionTime',
              null
            ]
          }
        }
      }
    },
    {
      $project: {
        status: '$_id',
        count: 1,
        avgResolutionTime: 1,
        _id: 0
      }
    }
  ]);
};

ticketSchema.statics.getTicketStatsByCategory = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$category',
        total: { $sum: 1 },
        resolved: {
          $sum: {
            $cond: [
              { $in: ['$status', ['Resolved', 'Closed']] },
              1,
              0
            ]
          }
        },
        high: {
          $sum: {
            $cond: [
              { $in: ['$priority', ['High', 'Urgent']] },
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
        total: 1,
        resolved: 1,
        high: 1,
        resolutionRate: {
          $multiply: [
            { $divide: ['$resolved', { $max: ['$total', 1] }] },
            100
          ]
        },
        _id: 0
      }
    }
  ]);
};

const AdminSupportTicket = mongoose.model('AdminSupportTicket', ticketSchema);

export default AdminSupportTicket; 