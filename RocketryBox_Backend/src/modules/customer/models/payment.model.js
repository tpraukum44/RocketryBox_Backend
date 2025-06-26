import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: false
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer ID is required']
  },
  razorpayOrderId: {
    type: String,
    required: [true, 'Razorpay order ID is required'],
    unique: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true // Allow null but unique when present
  },
  razorpaySignature: {
    type: String
  },
  amount: {
    type: Number,
    required: [true, 'Payment amount is required'],
    min: [0, 'Amount cannot be negative']
  },
  currency: {
    type: String,
    required: [true, 'Currency is required'],
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'attempted', 'completed', 'failed', 'refunded'],
    default: 'created',
    required: true
  },
  paymentMethod: {
    type: String,
    enum: ['card', 'netbanking', 'wallet', 'upi', 'other'],
    default: 'other'
  },
  failureReason: {
    type: String
  },
  refundId: {
    type: String
  },
  refundAmount: {
    type: Number,
    min: 0
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'processed', 'failed']
  },
  paidAt: {
    type: Date
  },
  refundedAt: {
    type: Date
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  },
  notes: {
    type: String
  }
}, {
  timestamps: true
});

// Indexes for better query performance
paymentSchema.index({ customerId: 1, createdAt: -1 });
paymentSchema.index({ orderId: 1 }, { sparse: true });
// razorpayOrderId already has unique: true which creates an index
// razorpayPaymentId already has sparse: true which creates an index
paymentSchema.index({ status: 1 });

// Virtual for payment age
paymentSchema.virtual('paymentAge').get(function() {
  if (this.paidAt) {
    return Math.floor((Date.now() - this.paidAt.getTime()) / (1000 * 60 * 60 * 24));
  }
  return null;
});

// Instance method to check if payment is successful
paymentSchema.methods.isSuccessful = function() {
  return this.status === 'completed' && this.razorpayPaymentId;
};

// Instance method to check if payment can be refunded
paymentSchema.methods.canBeRefunded = function() {
  return this.status === 'completed' && !this.refundId;
};

// Static method to get payment statistics
paymentSchema.statics.getPaymentStats = async function(customerId, startDate, endDate) {
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
        totalAmount: { $sum: '$amount' }
      }
    }
  ]);
};

// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Set paidAt when status changes to completed
  if (this.isModified('status') && this.status === 'completed' && !this.paidAt) {
    this.paidAt = new Date();
  }
  
  // Set refundedAt when refund is processed
  if (this.isModified('refundStatus') && this.refundStatus === 'processed' && !this.refundedAt) {
    this.refundedAt = new Date();
  }
  
  next();
});

const Payment = mongoose.model('Payment', paymentSchema);

export default Payment; 