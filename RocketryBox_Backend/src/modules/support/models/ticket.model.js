import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  content: { 
    type: String,
    required: true 
  },
  postedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'postedByType',
    required: true
  },
  postedByType: {
    type: String,
    enum: ['Admin', 'Seller', 'Customer'],
    required: true
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const ticketSchema = new mongoose.Schema({
  ticketNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  subject: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['Technical', 'Billing', 'Shipping', 'Returns', 'Account', 'Other'],
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
    enum: ['New', 'In Progress', 'Waiting for Customer', 'Resolved', 'Closed'],
    default: 'New',
    index: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'createdByType',
    required: true,
    index: true
  },
  createdByType: {
    type: String,
    enum: ['Admin', 'Seller', 'Customer'],
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  relatedTo: {
    type: String,
    enum: ['Order', 'Shipment', 'Product', 'Account', 'Other']
  },
  relatedId: {
    type: String
  },
  comments: [commentSchema],
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  metadata: {
    browser: String,
    os: String,
    ip: String
  },
  resolution: {
    resolvedAt: Date,
    resolvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin'
    },
    resolutionNote: String
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
});

// Generate ticket number
ticketSchema.pre('save', function(next) {
  if (this.isNew) {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    this.ticketNumber = `TKT-${year}${month}-${random}`;
  }
  this.updatedAt = new Date();
  next();
});

export default mongoose.model('Ticket', ticketSchema); 