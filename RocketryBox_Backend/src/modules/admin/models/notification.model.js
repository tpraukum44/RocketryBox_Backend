import mongoose from 'mongoose';

// Email notification configuration schema
const emailConfigSchema = new mongoose.Schema({
  emailMethod: {
    type: String,
    enum: ['php', 'smtp', 'sendgrid', 'mailjet'],
    default: 'smtp'
  },
  smtpHost: {
    type: String,
    trim: true
  },
  smtpPort: {
    type: Number
  },
  smtpUsername: {
    type: String,
    trim: true
  },
  smtpPassword: {
    type: String
  },
  smtpEncryption: {
    type: String,
    enum: ['tls', 'ssl', 'none'],
    default: 'tls'
  },
  sendgridApiKey: {
    type: String
  },
  mailjetApiKey: {
    type: String
  },
  mailjetSecretKey: {
    type: String
  },
  emailSentFromName: {
    type: String,
    trim: true
  },
  emailSentFromEmail: {
    type: String,
    trim: true
  },
  emailBody: {
    type: String
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// SMS notification configuration schema
const smsConfigSchema = new mongoose.Schema({
  smsMethod: {
    type: String,
    enum: ['nexmo', 'clickatell', 'message_bird', 'infobip'],
    default: 'nexmo'
  },
  apiKey: {
    type: String
  },
  apiSecret: {
    type: String
  },
  smsSentFrom: {
    type: String,
    trim: true
  },
  smsBody: {
    type: String
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// System notification configuration schema
const notificationSystemConfigSchema = new mongoose.Schema({
  emailNotification: {
    type: Boolean,
    default: true
  },
  smsNotification: {
    type: Boolean,
    default: false
  },
  languageOption: {
    type: Boolean,
    default: false
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Email template schema
const emailTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true
  },
  subject: {
    type: String,
    required: [true, 'Email subject is required'],
    trim: true
  },
  body: {
    type: String,
    required: [true, 'Email body is required']
  },
  variables: [{
    name: String,
    description: String
  }],
  type: {
    type: String,
    enum: [
      'user_registration',
      'password_reset',
      'order_confirmation',
      'shipping_confirmation',
      'delivery_confirmation',
      'cancelation',
      'return',
      'refund',
      'admin_notification',
      'seller_registration',
      'seller_approval',
      'custom'
    ],
    default: 'custom'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// SMS template schema
const smsTemplateSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Template name is required'],
    trim: true
  },
  body: {
    type: String,
    required: [true, 'SMS body is required']
  },
  variables: [{
    name: String,
    description: String
  }],
  type: {
    type: String,
    enum: [
      'user_registration',
      'order_confirmation',
      'shipping_confirmation',
      'delivery_confirmation',
      'otp_verification',
      'custom'
    ],
    default: 'custom'
  },
  isActive: {
    type: Boolean,
    default: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Admin'
  }
}, {
  timestamps: true
});

// Create and export the models
const EmailConfig = mongoose.model('EmailConfig', emailConfigSchema);
const SMSConfig = mongoose.model('SMSConfig', smsConfigSchema);
const NotificationSystemConfig = mongoose.model('NotificationSystemConfig', notificationSystemConfigSchema);
const EmailTemplate = mongoose.model('EmailTemplate', emailTemplateSchema);
const SMSTemplate = mongoose.model('SMSTemplate', smsTemplateSchema);

export {
  EmailConfig,
  SMSConfig,
  NotificationSystemConfig,
  EmailTemplate,
  SMSTemplate
}; 