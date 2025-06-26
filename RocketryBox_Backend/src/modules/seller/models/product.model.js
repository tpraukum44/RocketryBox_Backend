import mongoose from 'mongoose';

const dimensionsSchema = new mongoose.Schema({
  length: Number,
  width: Number,
  height: Number
}, { _id: false });

const variantSchema = new mongoose.Schema({
  name: String,
  sku: String,
  price: Number,
  quantity: Number
}, { _id: false });

const inventorySchema = new mongoose.Schema({
  quantity: { type: Number, default: 0 },
  lowStockThreshold: { type: Number, default: 5 },
  reorderPoint: { type: Number, default: 10 }
}, { _id: false });

const productSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  sku: {
    type: String,
    required: true,
    index: true
  },
  description: String,
  category: {
    type: String,
    index: true
  },
  price: {
    type: Number,
    required: true
  },
  weight: Number,
  dimensions: dimensionsSchema,
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    default: 'Active',
    index: true
  },
  stock: {
    type: Number,
    required: true,
    default: 0
  },
  images: [String],
  inventory: inventorySchema,
  variants: [variantSchema],
  attributes: { type: mongoose.Schema.Types.Mixed },
  lastUpdated: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Add compound indexes for common query patterns
productSchema.index({ seller: 1, status: 1 });
productSchema.index({ seller: 1, category: 1, status: 1 });
productSchema.index({ seller: 1, stock: 1 });
productSchema.index({ name: 'text', description: 'text', sku: 'text' });

// Default filter to exclude inactive products
productSchema.pre(/^find/, function(next) {
  // Check if this query should skip the default filter
  const skipDefaultFilter = this.getOptions().skipDefaultFilter;
  
  // Apply default filter for normal queries
  if (!skipDefaultFilter && !this._conditions.status) {
    this.find({ status: 'Active' });
  }
  next();
});

// Update lastUpdated timestamp when product is modified
productSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Helper method to check if product is low in stock
productSchema.methods.isLowStock = function() {
  if (this.inventory && this.inventory.lowStockThreshold) {
    return this.stock <= this.inventory.lowStockThreshold;
  }
  return this.stock <= 5; // Default threshold
};

// Helper method to safely update product
productSchema.methods.updateSafe = async function(updates) {
  const allowedFields = [
    'name', 'description', 'category', 'price', 'weight', 
    'dimensions', 'status', 'stock', 'inventory', 'attributes'
  ];
  
  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      this[key] = updates[key];
    }
  });
  
  this.lastUpdated = new Date();
  return await this.save();
};

export default mongoose.model('Product', productSchema); 