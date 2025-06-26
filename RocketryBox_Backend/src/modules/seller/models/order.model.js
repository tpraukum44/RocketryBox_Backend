import mongoose from 'mongoose';

const addressSchema = new mongoose.Schema({
  street: String,
  city: String,
  state: String,
  pincode: String,
  country: { type: String, default: 'India' }
}, { _id: false });

const customerSchema = new mongoose.Schema({
  name: String,
  phone: String,
  email: String,
  address: addressSchema
}, { _id: false });

const dimensionsSchema = new mongoose.Schema({
  length: Number,
  width: Number,
  height: Number
}, { _id: false });

const productSchema = new mongoose.Schema({
  name: String,
  sku: String,
  quantity: Number,
  price: Number,
  weight: String,
  dimensions: dimensionsSchema
}, { _id: false });

const paymentSchema = new mongoose.Schema({
  method: { type: String, enum: ['COD', 'Prepaid'], required: true },
  amount: String,
  codCharge: String,
  shippingCharge: String,
  gst: String,
  total: String
}, { _id: false });

const orderSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderDate: {
    type: Date,
    required: true,
    index: true
  },
  customer: customerSchema,
  product: productSchema,
  payment: paymentSchema,
  status: {
    type: String,
    enum: ['Created', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
    default: 'Created',
    index: true
  },
  // Store available rates for shipping selection
  availableRates: [{
    courier: String,
    zone: String,
    weight: Number,
    base: Number,
    addlCharge: Number,
    cod: Number,
    total: Number
  }],
  orderTimeline: [
    {
      status: { type: String },
      timestamp: { type: Date, default: Date.now },
      comment: { type: String }
    }
  ],
  notes: [
    {
      note: { type: String },
      createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
      createdAt: { type: Date, default: Date.now }
    }
  ],
  awb: {
    type: String,
    index: true
  },
  courier: String,
  tracking: String,
  channel: {
    type: String,
    enum: ['MANUAL', 'EXCEL', 'SHOPIFY', 'WOOCOMMERCE', 'AMAZON', 'FLIPKART', 'OPENCART', 'API'],
    default: 'MANUAL',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Add compound indexes for common query patterns
orderSchema.index({ seller: 1, status: 1 });
orderSchema.index({ seller: 1, orderDate: -1 });
orderSchema.index({ seller: 1, channel: 1, status: 1 });
orderSchema.index({ createdAt: -1 });

// Filter out cancelled orders by default
orderSchema.pre(/^find/, function (next) {
  // Skip the default filter if explicitly requested
  const skipDefaultFilter = this.getOptions().skipDefaultFilter;

  if (!skipDefaultFilter && !this._conditions.status) {
    this.find({ status: { $ne: 'Cancelled' } });
  }
  next();
});

// Update the updatedAt timestamp on save
orderSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  next();
});

// Helper method to update order status safely
orderSchema.methods.updateStatus = async function (status, comment = '', updatedBy = null) {
  const validStatuses = ['Created', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

  if (!validStatuses.includes(status)) {
    throw new Error(`Invalid status: ${status}`);
  }

  this.status = status;

  // Add to timeline
  this.orderTimeline.push({
    status,
    timestamp: new Date(),
    comment: comment || `Order marked as ${status.toLowerCase()}`
  });

  // Add a note if provided
  if (comment && updatedBy) {
    this.notes.push({
      note: `Status changed to ${status}: ${comment}`,
      createdBy: updatedBy,
      createdAt: new Date()
    });
  }

  return await this.save();
};

// Helper method to get order summary
orderSchema.methods.getOrderSummary = function () {
  return {
    id: this._id,
    orderId: this.orderId,
    status: this.status,
    customer: this.customer.name,
    product: this.product.name,
    amount: this.payment.total,
    orderDate: this.orderDate,
    awb: this.awb,
    courier: this.courier
  };
};

export default mongoose.model('SellerOrder', orderSchema);
