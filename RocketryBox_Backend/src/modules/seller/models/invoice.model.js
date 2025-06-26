import mongoose from 'mongoose';

const invoiceItemSchema = new mongoose.Schema({
  description: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  unitPrice: { type: Number, required: true, min: 0 },
  total: { type: Number, required: true, min: 0 }
}, { _id: false });

const invoiceSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  invoiceNumber: { type: String, required: true, unique: true },
  date: { type: Date, default: Date.now },
  amount: { type: Number, required: true, min: 0 },
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'paid', 'overdue', 'cancelled', 'refunded'],
    default: 'draft'
  },
  dueDate: { type: Date, required: true },
  items: [invoiceItemSchema],
  tax: { type: Number, default: 0, min: 0 },
  total: { type: Number, required: true, min: 0 },
  paymentReference: { type: String },
  paymentMethod: { 
    type: String,
    enum: ['wallet', 'bank_transfer', 'upi', 'card', 'cash'],
    default: 'wallet'
  },
  paymentDate: { type: Date },
  remarks: { type: String },
  isDeleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, {
  timestamps: true
});

// Generate invoice number before saving
invoiceSchema.pre('save', async function(next) {
  if (this.isNew) {
    const count = await mongoose.model('Invoice').countDocuments();
    this.invoiceNumber = `INV-${String(count + 1).padStart(6, '0')}`;
  }
  next();
});

// Calculate total before saving
invoiceSchema.pre('save', function(next) {
  if (this.isModified('items') || this.isModified('tax')) {
    const itemsTotal = this.items.reduce((sum, item) => sum + item.total, 0);
    this.total = itemsTotal + this.tax;
  }
  next();
});

export default mongoose.model('Invoice', invoiceSchema); 