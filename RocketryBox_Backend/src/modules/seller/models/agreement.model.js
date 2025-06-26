import mongoose from 'mongoose';

const agreementSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['service', 'terms', 'privacy', 'courier', 'pod', 'custom'],
    required: true,
    index: true
  },
  title: {
    type: String,
    required: true
  },
  version: {
    type: String,
    required: true
  },
  content: {
    type: String,
    required: true
  },
  documentUrl: String,
  status: {
    type: String,
    enum: ['draft', 'active', 'inactive', 'expired'],
    default: 'draft',
    index: true
  },
  acceptanceRequired: {
    type: Boolean,
    default: true
  },
  acceptedAt: Date,
  acceptedBy: {
    name: String,
    email: String,
    designation: String,
    ipAddress: String
  },
  expiryDate: Date,
  effectiveDate: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
});

// Update updatedAt timestamp on save
agreementSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Check if agreement is expired
agreementSchema.methods.isExpired = function() {
  if (!this.expiryDate) return false;
  return new Date() > this.expiryDate;
};

// Check if agreement is accepted
agreementSchema.methods.isAccepted = function() {
  return !!this.acceptedAt;
};

// Accept agreement
agreementSchema.methods.accept = async function(acceptanceDetails) {
  if (!this.acceptanceRequired) return true;
  
  this.status = 'active';
  this.acceptedAt = new Date();
  this.acceptedBy = {
    name: acceptanceDetails.name,
    email: acceptanceDetails.email,
    designation: acceptanceDetails.designation || 'Owner',
    ipAddress: acceptanceDetails.ipAddress
  };
  
  await this.save();
  return true;
};

export default mongoose.model('Agreement', agreementSchema); 