import mongoose from 'mongoose';

const maintenanceSchema = new mongoose.Schema({
  isEnabled: {
    type: Boolean,
    default: false
  },
  startTime: {
    type: Date
  },
  endTime: {
    type: Date
  },
  message: {
    type: String,
    default: 'The system is currently undergoing maintenance. Please check back later.'
  },
  allowAdminAccess: {
    type: Boolean,
    default: true
  },
  whitelistedIPs: [{
    ip: {
      type: String,
      trim: true
    },
    description: {
      type: String,
      trim: true
    },
    addedAt: {
      type: Date,
      default: Date.now
    }
  }],
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Create or get the current maintenance settings
maintenanceSchema.statics.getCurrentSettings = async function() {
  // Get the first maintenance settings document or create if it doesn't exist
  let maintenanceSettings = await this.findOne();
  
  if (!maintenanceSettings) {
    maintenanceSettings = await this.create({
      isEnabled: false,
      message: 'The system is currently undergoing maintenance. Please check back later.',
      allowAdminAccess: true,
      whitelistedIPs: []
    });
  }
  
  return maintenanceSettings;
};

// Check if IP is whitelisted
maintenanceSchema.methods.isIPWhitelisted = function(ipAddress) {
  return this.whitelistedIPs.some(item => item.ip === ipAddress);
};

// Add IP to whitelist
maintenanceSchema.methods.addIPToWhitelist = function(ip, description = '') {
  // Check if IP already exists
  const existingIndex = this.whitelistedIPs.findIndex(item => item.ip === ip);
  
  if (existingIndex !== -1) {
    // Update existing entry
    this.whitelistedIPs[existingIndex].description = description;
    this.whitelistedIPs[existingIndex].addedAt = new Date();
  } else {
    // Add new entry
    this.whitelistedIPs.push({
      ip,
      description,
      addedAt: new Date()
    });
  }
  
  return this;
};

// Remove IP from whitelist
maintenanceSchema.methods.removeIPFromWhitelist = function(ip) {
  this.whitelistedIPs = this.whitelistedIPs.filter(item => item.ip !== ip);
  return this;
};

const MaintenanceSettings = mongoose.model('MaintenanceSettings', maintenanceSchema);

export default MaintenanceSettings; 