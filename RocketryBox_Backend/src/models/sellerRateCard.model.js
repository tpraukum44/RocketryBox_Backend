import mongoose from 'mongoose';

const sellerRateCardSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  // Reference to the base rate card being overridden
  baseRateCard: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RateCard',
    required: true
  },
  // Override values - only specified fields will override the base rates
  courier: {
    type: String,
    required: true
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
    enum: ['Within City', 'Within State', 'Within Region', 'Metro to Metro', 'Rest of India', 'Special Zone', 'North East & Special Areas']
  },
  // Override rates (if null, use base rate card values)
  baseRate: {
    type: Number,
    min: 0,
    default: null // null means use base rate card value
  },
  addlRate: {
    type: Number,
    min: 0,
    default: null // null means use base rate card value
  },
  codAmount: {
    type: Number,
    min: 0,
    default: null // null means use base rate card value
  },
  codPercent: {
    type: Number,
    min: 0,
    max: 100,
    default: null // null means use base rate card value
  },
  rtoCharges: {
    type: Number,
    min: 0,
    default: null // null means use base rate card value
  },
  minimumBillableWeight: {
    type: Number,
    min: 0,
    default: null // null means use base rate card value
  },
  isActive: {
    type: Boolean,
    default: true
  },
  // Administrative tracking
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  notes: {
    type: String,
    maxlength: 500
  }
}, {
  timestamps: true
});

// Compound index to ensure one override per seller per rate card combination
sellerRateCardSchema.index({
  seller: 1,
  courier: 1,
  productName: 1,
  mode: 1,
  zone: 1
}, { unique: true });

// Index for faster lookups
sellerRateCardSchema.index({ seller: 1, isActive: 1 });
sellerRateCardSchema.index({ baseRateCard: 1 });

// Method to get effective rate (override or base)
sellerRateCardSchema.methods.getEffectiveRate = function (baseRateCard) {
  return {
    courier: this.courier,
    productName: this.productName,
    mode: this.mode,
    zone: this.zone,
    baseRate: this.baseRate !== null ? this.baseRate : baseRateCard.baseRate,
    addlRate: this.addlRate !== null ? this.addlRate : baseRateCard.addlRate,
    codAmount: this.codAmount !== null ? this.codAmount : baseRateCard.codAmount,
    codPercent: this.codPercent !== null ? this.codPercent : baseRateCard.codPercent,
    rtoCharges: this.rtoCharges !== null ? this.rtoCharges : baseRateCard.rtoCharges,
    minimumBillableWeight: this.minimumBillableWeight !== null ? this.minimumBillableWeight : baseRateCard.minimumBillableWeight,
    isActive: this.isActive,
    isOverride: true,
    overrideId: this._id,
    baseRateCardId: this.baseRateCard,
    lastUpdated: this.updatedAt
  };
};

// Static method to get seller's effective rate cards (base + overrides)
sellerRateCardSchema.statics.getSellerEffectiveRates = async function (sellerId) {
  const RateCard = mongoose.model('RateCard');
  const Seller = mongoose.model('Seller');

  // Get seller's assigned rate band
  const seller = await Seller.findById(sellerId).select('rateBand').lean();
  if (!seller) {
    throw new Error(`Seller not found: ${sellerId}`);
  }

  // Determine rate band - null means default RBX1
  const sellerRateBand = seller.rateBand || 'RBX1';

  console.log(`🎯 Getting effective rates for seller ${sellerId} with rate band: ${sellerRateBand}`);

  // Get base rate cards for seller's specific rate band
  const baseRateCards = await RateCard.find({
    isActive: true,
    rateBand: sellerRateBand
  }).lean();

  console.log(`📋 Found ${baseRateCards.length} base rate cards for rate band: ${sellerRateBand}`);

  // Get seller's overrides
  const sellerOverrides = await this.find({
    seller: sellerId,
    isActive: true
  }).populate('baseRateCard').lean();

  // Create a map of overrides by rate card combination
  const overrideMap = new Map();
  sellerOverrides.forEach(override => {
    const key = `${override.courier}-${override.productName}-${override.mode}-${override.zone}`;
    overrideMap.set(key, override);
  });

  // Build effective rate cards
  const effectiveRates = baseRateCards.map(baseCard => {
    const key = `${baseCard.courier}-${baseCard.productName}-${baseCard.mode}-${baseCard.zone}`;
    const override = overrideMap.get(key);

    if (override) {
      // Apply overrides
      return {
        ...baseCard,
        baseRate: override.baseRate !== null ? override.baseRate : baseCard.baseRate,
        addlRate: override.addlRate !== null ? override.addlRate : baseCard.addlRate,
        codAmount: override.codAmount !== null ? override.codAmount : baseCard.codAmount,
        codPercent: override.codPercent !== null ? override.codPercent : baseCard.codPercent,
        rtoCharges: override.rtoCharges !== null ? override.rtoCharges : baseCard.rtoCharges,
        minimumBillableWeight: override.minimumBillableWeight !== null ? override.minimumBillableWeight : baseCard.minimumBillableWeight,
        isOverride: true,
        overrideId: override._id,
        baseRateCardId: baseCard._id,
        lastUpdated: override.updatedAt,
        notes: override.notes,
        sellerRateBand: sellerRateBand // Include rate band info
      };
    }

    // Return base card as-is
    return {
      ...baseCard,
      isOverride: false,
      baseRateCardId: baseCard._id,
      lastUpdated: baseCard.updatedAt,
      sellerRateBand: sellerRateBand // Include rate band info
    };
  });

  console.log(`✅ Returning ${effectiveRates.length} effective rates for seller ${sellerId} (rate band: ${sellerRateBand})`);

  return effectiveRates;
};

// Static method to create or update seller rate override
sellerRateCardSchema.statics.createOrUpdateOverride = async function (sellerId, rateCardData, adminId) {
  const RateCard = mongoose.model('RateCard');

  // Find the base rate card
  const baseRateCard = await RateCard.findOne({
    courier: rateCardData.courier,
    productName: rateCardData.productName,
    mode: rateCardData.mode,
    zone: rateCardData.zone,
    isActive: true
  });

  if (!baseRateCard) {
    throw new Error(`Base rate card not found for ${rateCardData.courier} - ${rateCardData.productName} - ${rateCardData.mode} - ${rateCardData.zone}`);
  }

  // Check if override already exists
  const existingOverride = await this.findOne({
    seller: sellerId,
    courier: rateCardData.courier,
    productName: rateCardData.productName,
    mode: rateCardData.mode,
    zone: rateCardData.zone
  });

  const overrideData = {
    seller: sellerId,
    baseRateCard: baseRateCard._id,
    courier: rateCardData.courier,
    productName: rateCardData.productName,
    mode: rateCardData.mode,
    zone: rateCardData.zone,
    baseRate: rateCardData.baseRate,
    addlRate: rateCardData.addlRate,
    codAmount: rateCardData.codAmount,
    codPercent: rateCardData.codPercent,
    rtoCharges: rateCardData.rtoCharges,
    minimumBillableWeight: rateCardData.minimumBillableWeight,
    isActive: rateCardData.isActive !== undefined ? rateCardData.isActive : true,
    notes: rateCardData.notes,
    updatedBy: adminId
  };

  if (existingOverride) {
    // Update existing override
    Object.assign(existingOverride, overrideData);
    await existingOverride.save();
    return { override: existingOverride, isNew: false };
  } else {
    // Create new override
    overrideData.createdBy = adminId;
    const newOverride = await this.create(overrideData);
    return { override: newOverride, isNew: true };
  }
};

export default mongoose.model('SellerRateCard', sellerRateCardSchema);
