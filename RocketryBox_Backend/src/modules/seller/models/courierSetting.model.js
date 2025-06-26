import mongoose from 'mongoose';

const courierSettingSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  courierName: {
    type: String,
    required: true
  },
  accountId: {
    type: String
  },
  apiKey: {
    type: String
  },
  apiSecret: {
    type: String
  },
  pickupLocation: {
    type: String
  },
  serviceablePincodes: [String],
  maxWeight: {
    type: Number
  },
  maxValue: {
    type: Number
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

export default mongoose.model('CourierSetting', courierSettingSchema); 