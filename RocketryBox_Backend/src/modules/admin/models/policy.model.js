import mongoose from 'mongoose';

const policySchema = new mongoose.Schema({
  title: {
    type: String,
    required: [true, 'Policy title is required'],
    trim: true
  },
  slug: {
    type: String,
    required: [true, 'Policy slug is required'],
    trim: true,
    unique: true,
    lowercase: true
  },
  content: {
    type: String,
    required: [true, 'Policy content is required']
  },
  seoTitle: {
    type: String,
    trim: true
  },
  seoDescription: {
    type: String,
    trim: true
  },
  seoKeywords: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['draft', 'published'],
    default: 'draft'
  },
  type: {
    type: String,
    enum: [
      'terms-of-service',
      'privacy-policy',
      'shipping-policy',
      'return-policy',
      'refund-policy',
      'cookie-policy',
      'user-agreement',
      'seller-agreement',
      'custom'
    ],
    default: 'custom'
  },
  isDefault: {
    type: Boolean,
    default: false
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

// Ensure the slug is unique for the policy type
policySchema.index({ slug: 1, type: 1 }, { unique: true });

// Create a text index for search functionality
policySchema.index({ title: 'text', content: 'text', seoKeywords: 'text' });

// Pre-save hook to generate slug if not provided
policySchema.pre('save', function(next) {
  if (!this.isModified('title') || this.slug) {
    return next();
  }
  
  // Generate slug from title
  this.slug = this.title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces and underscores with hyphens
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
  
  next();
});

// Create static method to get policy by type
policySchema.statics.getByType = async function(type) {
  return this.findOne({ type, status: 'published' })
    .sort({ updatedAt: -1 })
    .exec();
};

// Create static method to get default policies
policySchema.statics.getDefaultPolicies = async function() {
  return this.find({ isDefault: true, status: 'published' }).exec();
};

const Policy = mongoose.model('Policy', policySchema);

export default Policy; 