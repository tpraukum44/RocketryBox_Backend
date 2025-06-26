import mongoose from 'mongoose';

const shippingChargeSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Seller ID is required']
  },
  sellerName: {
    type: String,
    required: [true, 'Seller name is required'],
    trim: true
  },
  courierName: {
    type: String,
    required: [true, 'Courier name is required'],
    trim: true
  },
  courierMode: {
    type: String,
    trim: true
  },
  airwaybillNumber: {
    type: String,
    required: [true, 'Airway bill number is required'],
    trim: true
  },
  orderNumber: {
    type: String,
    required: [true, 'Order number is required'],
    trim: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  time: {
    type: String,
    trim: true
  },
  shipmentType: {
    type: String,
    required: [true, 'Shipment type is required'],
    trim: true
  },
  productType: {
    type: String,
    trim: true
  },
  originPincode: {
    type: String,
    required: [true, 'Origin pincode is required'],
    trim: true
  },
  destinationPincode: {
    type: String,
    required: [true, 'Destination pincode is required'],
    trim: true
  },
  originCity: {
    type: String,
    trim: true
  },
  destinationCity: {
    type: String,
    trim: true
  },
  bookedWeight: {
    type: String,
    required: [true, 'Booked weight is required'],
    trim: true
  },
  volWeight: {
    type: String,
    trim: true
  },
  chargeableAmount: {
    type: Number,
    required: [true, 'Chargeable amount is required']
  },
  declaredValue: {
    type: Number
  },
  collectableValue: {
    type: Number
  },
  freightCharge: {
    type: Number,
    required: [true, 'Freight charge is required']
  },
  codCharge: {
    type: Number,
    default: 0
  },
  amountBeforeDiscount: {
    type: Number,
    required: [true, 'Amount before discount is required']
  },
  discount: {
    type: Number,
    default: 0
  },
  amountAfterDiscount: {
    type: Number,
    required: [true, 'Amount after discount is required']
  },
  status: {
    type: String,
    enum: ['delivered', 'in_transit', 'out_for_delivery', 'pickup_pending', 'rto', 'cancelled'],
    default: 'in_transit'
  },
  billableLane: {
    type: String,
    trim: true
  },
  customerGstState: {
    type: String,
    trim: true
  },
  customerGstin: {
    type: String,
    trim: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Index for faster querying
shippingChargeSchema.index({ sellerId: 1, createdAt: -1 });
shippingChargeSchema.index({ airwaybillNumber: 1 });
shippingChargeSchema.index({ orderNumber: 1 });
shippingChargeSchema.index({ status: 1 });
shippingChargeSchema.index({ courierName: 1 });

const ShippingCharge = mongoose.model('ShippingCharge', shippingChargeSchema);

export default ShippingCharge; 