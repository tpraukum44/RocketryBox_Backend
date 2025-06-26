import mongoose from 'mongoose';

const sessionSchema = new mongoose.Schema({
  adminId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin',
    required: true
  },
  token: {
    type: String,
    required: true
  },
  deviceInfo: {
    deviceId: String,
    deviceType: String,
    os: String,
    browser: String
  },
  ipAddress: String,
  lastActive: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, {
  timestamps: true
});

// Index for faster lookups and automatic expiration
sessionSchema.index({ adminId: 1 });
sessionSchema.index({ token: 1 });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Session = mongoose.model('AdminSession', sessionSchema);

export default Session; 