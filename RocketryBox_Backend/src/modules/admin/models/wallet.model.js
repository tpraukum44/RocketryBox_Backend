import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  referenceNumber: {
    type: String,
    required: [true, 'Reference number is required'],
    trim: true
  },
  orderId: {
    type: String,
    trim: true
  },
  type: {
    type: String,
    enum: ['Recharge', 'Debit', 'COD Credit', 'Refund'],
    required: [true, 'Transaction type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Transaction amount is required']
  },
  codCharge: {
    type: Number,
    default: 0
  },
  igst: {
    type: Number,
    default: 0
  },
  subTotal: {
    type: Number,
    required: [true, 'Sub-total is required']
  },
  closingBalance: {
    type: Number,
    required: [true, 'Closing balance is required']
  },
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller ID is required']
  },
  remark: {
    type: String,
    trim: true
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
walletTransactionSchema.index({ sellerId: 1, createdAt: -1 });
walletTransactionSchema.index({ referenceNumber: 1 }, { unique: true });
walletTransactionSchema.index({ orderId: 1 });
walletTransactionSchema.index({ type: 1 });

const AdminWalletTransaction = mongoose.model('AdminWalletTransaction', walletTransactionSchema);

export default AdminWalletTransaction; 