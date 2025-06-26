import mongoose from 'mongoose';

const walletTransactionSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true },
  date: { type: Date, default: Date.now },
  referenceNumber: { type: String },
  orderId: { type: mongoose.Schema.Types.ObjectId, ref: 'SellerOrder' },
  type: { type: String, enum: ['Recharge', 'Debit', 'COD Credit', 'Refund'], required: true },
  amount: { type: String, required: true },
  codCharge: { type: String, default: '0' },
  igst: { type: String, default: '0' },
  subTotal: { type: String, default: '0' },
  closingBalance: { type: String, default: '0' },
  remark: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('WalletTransaction', walletTransactionSchema); 