import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  city: {
    type: String,
    required: true
  },
  state: {
    type: String,
    required: true
  },
  pincode: {
    type: String,
    required: true,
    match: [/^\d{6}$/, 'Please provide a valid 6-digit pincode']
  },
  country: {
    type: String,
    default: 'India'
  },
  contactPerson: {
    type: String
  },
  phone: {
    type: String
  },
  email: {
    type: String
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Create index for better query performance
warehouseSchema.index({ seller: 1, isActive: 1 });
warehouseSchema.index({ seller: 1, pincode: 1 });

export default mongoose.model('Warehouse', warehouseSchema);
