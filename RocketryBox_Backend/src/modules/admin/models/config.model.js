import mongoose from 'mongoose';

const configSchema = new mongoose.Schema({
  key: {
    type: String,
    required: [true, 'Configuration key is required'],
    unique: true,
    trim: true
  },
  value: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Configuration value is required']
  },
  description: {
    type: String,
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Configuration category is required'],
    trim: true,
    default: 'General'
  },
  type: {
    type: String,
    enum: ['String', 'Number', 'Boolean', 'Object', 'Array'],
    default: 'String'
  },
  isSystemCritical: {
    type: Boolean,
    default: false
  },
  isHidden: {
    type: Boolean,
    default: false
  },
  history: [
    {
      value: mongoose.Schema.Types.Mixed,
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin'
      },
      updatedAt: {
        type: Date,
        default: Date.now
      }
    }
  ]
}, {
  timestamps: true
});

// Middleware to validate value type based on the specified type
configSchema.pre('save', function(next) {
  // Skip validation if value is not being modified
  if (!this.isModified('value')) return next();
  
  try {
    // Validate value based on type
    switch(this.type) {
      case 'String':
        if (typeof this.value !== 'string') {
          throw new Error('Value must be a string');
        }
        break;
      case 'Number':
        if (typeof this.value !== 'number') {
          this.value = parseFloat(this.value);
          if (isNaN(this.value)) {
            throw new Error('Value must be a number');
          }
        }
        break;
      case 'Boolean':
        if (typeof this.value !== 'boolean') {
          if (this.value === 'true') this.value = true;
          else if (this.value === 'false') this.value = false;
          else throw new Error('Value must be a boolean');
        }
        break;
      case 'Object':
        if (typeof this.value !== 'object' || this.value === null || Array.isArray(this.value)) {
          try {
            this.value = JSON.parse(this.value);
            if (typeof this.value !== 'object' || this.value === null || Array.isArray(this.value)) {
              throw new Error();
            }
          } catch (e) {
            throw new Error('Value must be a valid object');
          }
        }
        break;
      case 'Array':
        if (!Array.isArray(this.value)) {
          try {
            this.value = JSON.parse(this.value);
            if (!Array.isArray(this.value)) {
              throw new Error();
            }
          } catch (e) {
            throw new Error('Value must be a valid array');
          }
        }
        break;
    }
    next();
  } catch (error) {
    next(error);
  }
});

// Method to check if a config is system critical
configSchema.methods.isCritical = function() {
  return this.isSystemCritical === true;
};

const Config = mongoose.model('Config', configSchema);

export default Config; 