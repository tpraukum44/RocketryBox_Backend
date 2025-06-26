import mongoose from 'mongoose';

const ledgerSchema = new mongoose.Schema({
  seller: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Seller', 
    required: true 
  },
  transactionId: { 
    type: String, 
    required: true,
  },
  date: {
    type: Date,
    default: Date.now
  },
  type: {
    type: String,
    enum: [
      'recharge',           // Wallet recharge
      'shipping_charge',    // Shipping cost deduction
      'cod_credit',         // COD amount credit
      'refund',            // Refund to customer
      'commission',        // Platform commission
      'adjustment',        // Manual adjustment
      'penalty',           // Penalty charges
      'settlement',        // Settlement payout
      'chargeback',        // Chargeback from payment gateway
      'reversal',          // Transaction reversal
      'subscription',      // Subscription charges
      'service_fee'        // Service fees
    ],
    required: true
  },
  transactionBy: {
    type: String,
    required: true
  },
  credit: {
    type: String,
    default: null
  },
  debit: {
    type: String,
    default: null
  },
  taxableAmount: {
    type: String,
    default: null
  },
  igst: {
    type: String,
    default: null
  },
  cgst: {
    type: String,
    default: null
  },
  sgst: {
    type: String,
    default: null
  },
  totalAmount: {
    type: String,
    required: true
  },
  closingBalance: {
    type: String,
    required: true
  },
  transactionAgainst: {
    type: String,
    required: true
  },
  remark: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed', 'processing'],
    default: 'pending'
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Generate transaction ID before saving
ledgerSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Ledger').countDocuments();
    this.transactionId = `TXN-${String(count + 1).padStart(8, '0')}`;
  }
  next();
});

// Calculate closing balance
ledgerSchema.pre('save', async function(next) {
  if (this.isNew) {
    const lastEntry = await mongoose.model('Ledger')
      .findOne({ seller: this.seller })
      .sort({ createdAt: -1 })
      .select('closingBalance');
    
    const lastBalance = lastEntry ? parseFloat(lastEntry.closingBalance) : 0;
    const currentAmount = parseFloat(this.totalAmount);
    
    this.closingBalance = (lastBalance + currentAmount).toString();
  }
  next();
});

// Handle reversal
ledgerSchema.methods.reverse = async function(reason) {
  if (this.status === 'reversed') {
    throw new Error('Transaction already reversed');
  }

  const reversal = await mongoose.model('Ledger').create({
    seller: this.seller,
    type: 'reversal',
    amount: -this.amount,
    reference: `REV-${this.transactionId}`,
    description: `Reversal of ${this.transactionId}`,
    reversedTransaction: this._id,
    reversalReason: reason,
    metadata: this.metadata
  });

  this.status = 'reversed';
  await this.save();

  return reversal;
};

// Indexes for better query performance
ledgerSchema.index({ seller: 1, createdAt: -1 });
ledgerSchema.index({ transactionId: 1 }, { unique: true });
ledgerSchema.index({ type: 1 });
ledgerSchema.index({ status: 1 });
ledgerSchema.index({ transactionAgainst: 1 });

export default mongoose.model('Ledger', ledgerSchema); 