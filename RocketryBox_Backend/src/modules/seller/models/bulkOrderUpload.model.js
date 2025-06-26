import mongoose from 'mongoose';

const bulkOrderUploadSchema = new mongoose.Schema({
  sellerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true
  },
  originalFileName: {
    type: String,
    required: true
  },
  filePath: {
    type: String,
    required: true
  },
  totalRows: {
    type: Number,
    required: true,
    default: 0
  },
  processedRows: {
    type: Number,
    default: 0
  },
  failedRows: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['Processing', 'Completed', 'Failed', 'Cancelled'],
    default: 'Processing'
  },
  uploadErrors: [{
    row: Number,
    orderId: String,
    message: String
  }],
  uploadedAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for efficient queries
bulkOrderUploadSchema.index({ sellerId: 1, uploadedAt: -1 });
bulkOrderUploadSchema.index({ status: 1 });

export const BulkOrderUpload = mongoose.model('BulkOrderUpload', bulkOrderUploadSchema);
