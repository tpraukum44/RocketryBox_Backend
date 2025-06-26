import mongoose from 'mongoose';

const pincodeSchema = new mongoose.Schema({
  pincode: { type: String, required: true, index: true },
  officeName: String,
  district: String,
  state: String,
  region: String,
  circle: String,
  taluk: String,

  // Enhanced logistics fields
  logistics: {
    zone: {
      type: String,
      enum: ['Within City', 'Metro', 'Rest of India', 'North East', 'Special'],
      default: 'Rest of India'
    },
    isMetro: { type: Boolean, default: false },
    isServiceable: { type: Boolean, default: true },
    courierPartners: [{
      name: String,
      serviceTypes: [String], // ['standard', 'express', 'cod']
      isActive: { type: Boolean, default: true }
    }],
    deliveryTimeEstimate: {
      standard: { type: String, default: '3-5 days' },
      express: { type: String, default: '2-3 days' }
    },
    restrictions: [{
      type: String, // 'cod_blocked', 'hazmat_blocked', etc.
      description: String,
      effectiveFrom: Date,
      effectiveUntil: Date
    }],
    lastUpdated: { type: Date, default: Date.now }
  }
}, {
  timestamps: true
});

// Add compound indexes for better query performance
pincodeSchema.index({ 'logistics.zone': 1, 'logistics.isServiceable': 1 });
pincodeSchema.index({ state: 1, district: 1 });
pincodeSchema.index({ 'logistics.isMetro': 1 });

export default mongoose.model('Pincode', pincodeSchema);
