import mongoose from 'mongoose';

const rateCardSchema = new mongoose.Schema({
  courier: {
    type: String,
    required: true,
    index: true
  },
  productName: {
    type: String,
    required: true
  },
  mode: {
    type: String,
    required: true,
    enum: ['Surface', 'Air', 'Express', 'Standard', 'Premium']
  },
  zone: {
    type: String,
    required: true,
    index: true,
    enum: ['Within City', 'Within State', 'Within Region', 'Metro to Metro', 'Rest of India', 'Special Zone', 'North East & Special Areas']
  },
  // Rate Band - determines which sellers can use this rate card
  rateBand: {
    type: String,
    required: true,
    default: 'RBX1', // Default base rate band for all sellers
    index: true
  },
  baseRate: {
    type: Number,
    required: true,
    min: 0
  },
  addlRate: {
    type: Number,
    required: true,
    min: 0
  },
  codAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  codPercent: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  rtoCharges: {
    type: Number,
    default: 0,
    min: 0
  },
  minimumBillableWeight: {
    type: Number,
    required: true,
    min: 0
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // This will add createdAt and updatedAt fields
});

// Create compound index for efficient queries
rateCardSchema.index({ courier: 1, zone: 1, mode: 1 });
rateCardSchema.index({ zone: 1, isActive: 1 });
rateCardSchema.index({ rateBand: 1, isActive: 1 }); // Index for rate band filtering

// Add a method to find rates by zone and courier
rateCardSchema.statics.findByZoneAndCourier = function (zone, courier = null) {
  const query = { zone, isActive: true };
  if (courier) {
    query.courier = courier;
  }
  return this.find(query);
};

// Add a method to find rates by rate band
rateCardSchema.statics.findByRateBand = function (rateBand, zone = null, courier = null) {
  const query = { rateBand, isActive: true };
  if (zone) {
    query.zone = zone;
  }
  if (courier) {
    query.courier = courier;
  }
  return this.find(query);
};

// Add a method to get all active couriers
rateCardSchema.statics.getActiveCouriers = function () {
  return this.distinct('courier', { isActive: true });
};

export default mongoose.model('RateCard', rateCardSchema);
