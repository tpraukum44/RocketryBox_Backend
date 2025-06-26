import mongoose from 'mongoose';

const attemptHistorySchema = new mongoose.Schema({
  date: String,
  time: String,
  status: String,
  reason: String,
  agentRemarks: String
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: String,
  sku: String,
  quantity: Number,
  price: Number,
  image: String
}, { _id: false });

const ndrSchema = new mongoose.Schema({
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerOrder', required: true },
  awb: { type: String, required: true },
  shipmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerShipment', required: true },
  customer: {
    name: String,
    phone: String,
    email: String,
    address: {
      fullName: String,
      contactNumber: String,
      addressLine1: String,
      addressLine2: String,
      landmark: String,
      pincode: String,
      city: String,
      state: String
    }
  },
  seller: {
    id: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    name: String,
    contact: String
  },
  courier: {
    name: String,
    trackingUrl: String
  },
  attempts: { type: Number, default: 1 },
  attemptHistory: [attemptHistorySchema],
  status: { type: String, enum: ['Pending', 'In Progress', 'Resolved', 'RTO Initiated'], default: 'Pending' },
  reason: String,
  recommendedAction: String,
  currentLocation: {
    lat: Number,
    lng: Number
  },
  products: [productSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('NDR', ndrSchema); 