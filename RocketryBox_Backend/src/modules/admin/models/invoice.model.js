import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Item description is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Item quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: [true, 'Unit price is required'],
    min: [0, 'Unit price cannot be negative']
  },
  total: {
    type: Number,
    required: [true, 'Total price is required']
  }
});

const invoiceSchema = new mongoose.Schema({
  invoiceNumber: {
    type: String,
    required: [true, 'Invoice number is required'],
    trim: true
  },
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
  amount: {
    type: Number,
    required: [true, 'Invoice amount is required']
  },
  status: {
    type: String,
    enum: ['paid', 'due', 'cancelled'],
    default: 'due'
  },
  dueDate: {
    type: Date,
    required: [true, 'Due date is required']
  },
  items: [invoiceItemSchema],
  tax: {
    type: Number,
    required: [true, 'Tax amount is required'],
    default: 0
  },
  total: {
    type: Number,
    required: [true, 'Total amount is required']
  },
  paymentReference: {
    type: String,
    trim: true
  },
  remarks: {
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
invoiceSchema.index({ sellerId: 1, createdAt: -1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ status: 1 });
invoiceSchema.index({ dueDate: 1 });

const AdminInvoice = mongoose.model('AdminInvoice', invoiceSchema);

export default AdminInvoice; 