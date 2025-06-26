import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  entityType: {
    type: String,
    enum: ['TeamUser', 'Seller', 'Permission', 'Role'],
    required: true
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
    index: true
  },
  action: {
    type: String,
    enum: ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'ROLE_CHANGE', 'PERMISSION_CHANGE', 'STATUS_CHANGE'],
    required: true
  },
  performedBy: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'performedByModel',
    required: true
  },
  performedByModel: {
    type: String,
    enum: ['Seller', 'TeamUser'],
    required: true
  },
  performedByName: {
    type: String,
    required: true
  },
  description: {
    type: String,
    required: true
  },
  oldData: {
    type: mongoose.Schema.Types.Mixed
  },
  newData: {
    type: mongoose.Schema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  severity: {
    type: String,
    enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'LOW'
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
auditLogSchema.index({ seller: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ performedBy: 1, createdAt: -1 });

// Static method to create audit log
auditLogSchema.statics.createLog = async function (logData) {
  try {
    const log = new this(logData);
    await log.save();
    console.log(`📝 Audit log created: ${logData.action} for ${logData.entityType}`);
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // Don't throw error to prevent blocking main operations
    return null;
  }
};

// Static method to get logs for an entity
auditLogSchema.statics.getEntityLogs = async function (entityType, entityId, limit = 50) {
  return this.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('performedBy', 'name email businessName')
    .lean();
};

// Static method to get seller's audit logs
auditLogSchema.statics.getSellerLogs = async function (sellerId, options = {}) {
  const {
    limit = 100,
    page = 1,
    action,
    entityType,
    startDate,
    endDate
  } = options;

  const query = { seller: sellerId };

  if (action) query.action = action;
  if (entityType) query.entityType = entityType;
  if (startDate || endDate) {
    query.createdAt = {};
    if (startDate) query.createdAt.$gte = new Date(startDate);
    if (endDate) query.createdAt.$lte = new Date(endDate);
  }

  const skip = (page - 1) * limit;

  const [logs, total] = await Promise.all([
    this.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate('performedBy', 'name email businessName')
      .lean(),
    this.countDocuments(query)
  ]);

  return {
    logs,
    pagination: {
      total,
      page,
      limit,
      pages: Math.ceil(total / limit)
    }
  };
};

export default mongoose.model('AuditLog', auditLogSchema);
