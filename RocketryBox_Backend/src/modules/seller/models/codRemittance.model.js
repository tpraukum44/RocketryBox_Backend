import mongoose from 'mongoose';

const codRemittanceSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  remittanceId: {
    type: String,
    required: true,
    unique: true
  },
  status: {
    type: String,
    enum: ['Pending', 'Completed', 'Failed', 'Overdue'],
    default: 'Pending',
    index: true
  },
  paymentDate: {
    type: Date
  },
  remittanceAmount: {
    type: Number,
    required: true
  },
  freightDeduction: {
    type: Number,
    default: 0
  },
  convenienceFee: {
    type: Number,
    default: 0
  },
  total: {
    type: Number,
    required: true
  },
  paymentRef: {
    type: String
  },
  pushedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  remarks: {
    type: String
  }
}, {
  timestamps: true
});

// Generate remittanceId before saving
codRemittanceSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('CODRemittance').countDocuments();
    this.remittanceId = `CODREM-${String(count + 1).padStart(8, '0')}`;
  }
  next();
});

export default mongoose.model('CODRemittance', codRemittanceSchema); 