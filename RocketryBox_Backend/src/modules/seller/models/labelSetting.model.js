import mongoose from 'mongoose';

const labelSettingSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    unique: true
  },
  labelSize: {
    type: String,
    enum: ['A4', 'A5', '4x6', 'A6'],
    default: 'A4'
  },
  format: {
    type: String,
    enum: ['PDF', 'PNG', 'ZPL'],
    default: 'PDF'
  },
  showLogo: {
    type: Boolean,
    default: false
  },
  logoUrl: {
    type: String
  },
  showBarcode: {
    type: Boolean,
    default: true
  },
  showReturnLabel: {
    type: Boolean,
    default: false
  },
  additionalText: {
    type: String
  }
}, {
  timestamps: true
});

export default mongoose.model('LabelSetting', labelSettingSchema); 