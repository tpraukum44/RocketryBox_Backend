import mongoose from 'mongoose';
import crypto from 'crypto';

const apiSettingsSchema = new mongoose.Schema({
  seller: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Seller', 
    required: true, 
    unique: true 
  },
  apiKey: {
    type: String,
    required: true,
    unique: true
  },
  apiSecret: {
    type: String,
    required: true,
    select: false // Don't return in normal queries
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  lastUsed: {
    type: Date,
    default: null
  }
}, { 
  timestamps: true 
});

// Generate new API key and secret
apiSettingsSchema.statics.generateCredentials = function() {
  const apiKey = 'RB_' + crypto.randomBytes(16).toString('hex');
  const apiSecret = crypto.randomBytes(32).toString('hex');
  return { apiKey, apiSecret };
};

// Hash the API secret before saving
apiSettingsSchema.pre('save', async function(next) {
  if (this.isModified('apiSecret')) {
    this.apiSecret = crypto
      .createHash('sha256')
      .update(this.apiSecret)
      .digest('hex');
  }
  next();
});

export default mongoose.model('APISettings', apiSettingsSchema); 