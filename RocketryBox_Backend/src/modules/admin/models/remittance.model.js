import mongoose from 'mongoose';

const remittanceSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: [true, 'Transaction ID is required'],
    trim: true
  },
  transactionType: {
    type: String,
    enum: ['invoice', 'debit_note', 'credit_note'],
    required: [true, 'Transaction type is required']
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller ID is required']
  },
  sellerName: {
    type: String,
    required: [true, 'Seller name is required'],
    trim: true
  },
  amount: {
    type: Number,
    required: [true, 'Transaction amount is required']
  },
  paymentType: {
    type: String,
    enum: ['credit', 'wallet'],
    required: [true, 'Payment type is required']
  },
  status: {
    type: String,
    enum: ['paid', 'due'],
    default: 'due'
  },
  reference: {
    type: String,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  accountNumber: {
    type: String,
    trim: true
  },
  ifscCode: {
    type: String,
    trim: true
  },
  bankName: {
    type: String,
    trim: true
  },
  accountHolder: {
    type: String,
    trim: true
  },
  transactionFee: {
    type: Number,
    default: 0
  },
  netAmount: {
    type: Number,
    required: [true, 'Net amount is required']
  },
  processingTime: {
    type: Date
  },
  batchNumber: {
    type: String,
    trim: true
  },
  walletBalanceAfter: {
    type: Number
  },
  approvalBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Index for faster querying
remittanceSchema.index({ sellerId: 1, createdAt: -1 });
remittanceSchema.index({ transactionId: 1 }, { unique: true });
remittanceSchema.index({ status: 1 });
remittanceSchema.index({ transactionType: 1 });

const Remittance = mongoose.model('Remittance', remittanceSchema);

export default Remittance; 