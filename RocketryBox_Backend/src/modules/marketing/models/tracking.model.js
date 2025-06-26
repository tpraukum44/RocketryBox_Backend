import mongoose from 'mongoose';

const trackingSchema = new mongoose.Schema({
  trackingId: {
    type: String,
    required: [true, 'Tracking ID is required'],
    unique: true,
    trim: true
  },
  status: {
    type: String,
    required: [true, 'Status is required'],
    enum: ['pending', 'in_transit', 'delivered', 'exception'],
    default: 'pending'
  },
  location: {
    type: String,
    required: [true, 'Location is required'],
    trim: true
  },
  estimatedDelivery: {
    type: Date,
    required: [true, 'Estimated delivery date is required']
  },
  history: [{
    status: String,
    location: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt timestamp before saving
trackingSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Tracking = mongoose.model('Tracking', trackingSchema);

export default Tracking; 