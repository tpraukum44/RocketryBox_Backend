import mongoose from 'mongoose';

const supportTicketSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['Open', 'In Progress', 'Resolved', 'Closed'],
    default: 'Open'
  },
  priority: {
    type: String,
    enum: ['Low', 'Medium', 'High', 'Urgent'],
    default: 'Medium'
  },
  category: {
    type: String,
    enum: ['Technical', 'Billing', 'Shipping', 'Account', 'Other'],
    required: true
  },
  attachments: [{
    name: String,
    url: String,
    type: String
  }],
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    default: null
  },
  lastResponseAt: {
    type: Date,
    default: null
  },
  closedAt: {
    type: Date,
    default: null
  },
  closedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'closedByModel'
  },
  closedByModel: {
    type: String,
    enum: ['Admin', 'Seller'],
    default: null
  },
  responses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TicketResponse'
  }]
}, {
  timestamps: true
});

// Index for faster queries
supportTicketSchema.index({ seller: 1, status: 1 });
supportTicketSchema.index({ seller: 1, createdAt: -1 });

// Update lastResponseAt when a new response is added
supportTicketSchema.methods.updateLastResponse = function () {
  this.lastResponseAt = new Date();
  return this.save();
};

// Close ticket
supportTicketSchema.methods.closeTicket = function (userId, userModel) {
  this.status = 'Closed';
  this.closedAt = new Date();
  this.closedBy = userId;
  this.closedByModel = userModel;
  return this.save();
};

export default mongoose.model('SupportTicket', supportTicketSchema);
