import mongoose from 'mongoose';

const weightDisputeSchema = new mongoose.Schema({
  shipment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'SellerShipment',
    required: true
  },
  awbNumber: {
    type: String,
    required: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    index: true
  },
  given: {
    type: Number,
    required: true // original weight
  },
  applied: {
    type: Number,
    required: true // charged weight
  },
  revised: {
    type: Number
  },
  difference: {
    type: Number,
    required: true
  },
  accepted: {
    type: Boolean,
    default: false
  },
  product: {
    type: String
  },
  comments: {
    type: String
  },
  status: {
    type: String,
    enum: ['Action Required', 'Open Dispute', 'Closed Dispute', 'Closed Resolved'],
    default: 'Action Required',
    index: true
  },
  courierPartner: {
    type: String
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  }
}, {
  timestamps: true
});

export default mongoose.model('WeightDispute', weightDisputeSchema); 