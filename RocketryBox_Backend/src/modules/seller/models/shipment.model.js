import mongoose from 'mongoose';

const dimensionsSchema = new mongoose.Schema({
  length: Number,
  width: Number,
  height: Number
}, { _id: false });

const trackingEventSchema = new mongoose.Schema({
  status: String,
  location: String,
  timestamp: { type: Date, default: Date.now },
  description: String
}, { _id: false });

const shipmentSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerOrder', required: true },
  awb: { type: String, required: true, unique: true },
  courier: String,
  status: { type: String, enum: ['Booked', 'In-transit', 'Delivered', 'Pending Pickup', 'Cancelled', 'Exception'], default: 'Booked' },
  pickupDate: Date,
  deliveryDate: Date,
  weight: String,
  dimensions: dimensionsSchema,
  shippingCharge: String,
  trackingHistory: [trackingEventSchema],
  channel: { type: String, enum: ['MANUAL', 'EXCEL', 'SHOPIFY', 'WOOCOMMERCE', 'AMAZON', 'FLIPKART', 'OPENCART', 'API'], default: 'MANUAL' },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('SellerShipment', shipmentSchema); 