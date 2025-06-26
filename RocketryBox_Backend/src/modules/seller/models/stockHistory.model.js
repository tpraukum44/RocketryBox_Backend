import mongoose from 'mongoose';

const stockHistorySchema = new mongoose.Schema({
  item: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'WarehouseItem',
    required: true
  },
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  location: {
    type: String
  },
  notes: {
    type: String
  },
  type: {
    type: String,
    enum: ['add', 'remove'],
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

export default mongoose.model('StockHistory', stockHistorySchema); 