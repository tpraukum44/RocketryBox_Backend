import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';

const teamUserSchema = new mongoose.Schema({
  seller: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller',
    required: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    index: true
  },
  phone: {
    type: String
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  role: {
    type: String,
    enum: ['Manager', 'Support', 'Finance'],
    required: true
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive', 'Suspended', 'Pending'],
    default: 'Pending',
    index: true
  },
  permissions: {
    type: Object,
    default: {}
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Seller'
  },
  lastLogin: {
    type: Date
  },
  lastActive: {
    type: Date,
    default: Date.now,
    index: true
  },
  refreshToken: {
    type: String,
    select: false
  }
}, {
  timestamps: true
});

teamUserSchema.index({ seller: 1, status: 1 });
teamUserSchema.index({ email: 1, status: 1 });

teamUserSchema.pre(/^find/, function (next) {
  const skipDefaultFilter = this.getOptions().skipDefaultFilter;

  if (!skipDefaultFilter && !this._conditions.status) {
    this.find({ status: { $ne: 'Suspended' } });
  }
  next();
});

teamUserSchema.pre('save', function (next) {
  if (this.isModified('lastLogin')) {
    this.lastActive = new Date();
  }

  // Auto-assign role-based permissions when role changes
  if (this.isModified('role') || this.isNew) {
    this.assignRolePermissions();
    console.log(`🔐 Auto-assigned ${this.role} permissions to team user: ${this.email}`);
  }

  // Always validate permissions to ensure restricted access
  this.validatePermissions();

  this.updatedAt = new Date();
  next();
});

teamUserSchema.pre('save', async function (next) {
  try {
    if (!this.isModified('password')) {
      return next();
    }

    console.log('Hashing password for team user:', this.email);
    this.password = await bcrypt.hash(this.password, 10);
    console.log('Password hashed successfully for team user');
    next();
  } catch (error) {
    console.error('Error in team user password hashing:', error);
    next(error);
  }
});

teamUserSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

teamUserSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    {
      id: this._id,
      role: 'team_user',
      sellerId: this.seller,
      permissions: this.permissions
    },
    process.env.JWT_SECRET,
    {
      expiresIn: '7d' // 7 days - hardcoded
    }
  );
};

teamUserSchema.methods.generateRefreshToken = function () {
  return jwt.sign(
    {
      id: this._id,
      role: 'team_user',
      sellerId: this.seller
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    }
  );
};

// Define role-based permissions
const ROLE_PERMISSIONS = {
  Manager: {
    'Dashboard access': true,
    'Order': true,
    'Shipments': true,
    'Manifest': true,
    'Received': true,
    'New Order': true,
    'NDR List': true,
    'Weight Dispute': true,
    'Fright': true,
    'Invoice': true,
    'Ledger': true,
    'COD Remittance': true,
    'Support': true,
    'Warehouse': true,
    'Service': true,
    'Items & SKU': true,
    'Stores': true,
    'Priority': true,
    'Label': true,
    // Blocked permissions
    'Wallet': false,
    'Manage Users': false
  },
  Support: {
    'Dashboard access': true,
    'Order': true,
    'Shipments': true,
    'Manifest': true,
    'Received': true,
    'New Order': true,
    'NDR List': true,
    'Weight Dispute': true,
    'Support': true,
    'Warehouse': true,
    'Service': true,
    'Items & SKU': true,
    // Limited access
    'Fright': false,
    'Invoice': false,
    'Ledger': false,
    'COD Remittance': false,
    'Stores': false,
    'Priority': false,
    'Label': false,
    // Blocked permissions
    'Wallet': false,
    'Manage Users': false
  },
  Finance: {
    'Dashboard access': true,
    'Order': true,
    'Shipments': true,
    'Manifest': true,
    'Received': true,
    'New Order': false,
    'NDR List': true,
    'Weight Dispute': true,
    'Fright': true,
    'Invoice': true,
    'Ledger': true,
    'COD Remittance': true,
    'Support': false,
    'Warehouse': false,
    'Service': false,
    'Items & SKU': false,
    'Stores': false,
    'Priority': false,
    'Label': false,
    // Blocked permissions
    'Wallet': false,
    'Manage Users': false
  }
};

// Method to get permissions for a role
teamUserSchema.statics.getRolePermissions = function (role) {
  return ROLE_PERMISSIONS[role] || {};
};

// Method to assign role-based permissions
teamUserSchema.methods.assignRolePermissions = function () {
  this.permissions = ROLE_PERMISSIONS[this.role] || {};
  return this;
};

// Validate permissions (ensure restricted permissions are not granted)
teamUserSchema.methods.validatePermissions = function () {
  const restrictedPermissions = ['Wallet', 'Manage Users'];

  restrictedPermissions.forEach(permission => {
    if (this.permissions[permission] === true) {
      this.permissions[permission] = false;
    }
  });

  return this;
};

teamUserSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

teamUserSchema.statics.findByIdSafe = async function (id) {
  try {
    return await this.findById(id).populate('seller', 'businessName email').lean();
  } catch (error) {
    return null;
  }
};

teamUserSchema.methods.updateSafe = async function (updates) {
  const allowedFields = [
    'name', 'phone', 'role', 'status', 'permissions'
  ];

  Object.keys(updates).forEach(key => {
    if (allowedFields.includes(key)) {
      this[key] = updates[key];
    }
  });

  this.lastActive = new Date();
  this.updatedAt = new Date();
  return await this.save();
};

export default mongoose.model('TeamUser', teamUserSchema);
