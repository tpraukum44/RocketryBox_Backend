import { body, param } from 'express-validator';
import { validationHandler as validate } from '../../../middleware/validator.js';

// Validate email configuration update
export const validateEmailConfig = [
  body('emailMethod')
    .optional()
    .isIn(['php', 'smtp', 'sendgrid', 'mailjet'])
    .withMessage('Email method must be one of: php, smtp, sendgrid, mailjet'),
  
  body('smtpHost')
    .optional()
    .isString()
    .withMessage('SMTP host must be a string')
    .trim(),
  
  body('smtpPort')
    .optional()
    .isInt({ min: 1, max: 65535 })
    .withMessage('SMTP port must be between 1 and 65535'),
  
  body('smtpUsername')
    .optional()
    .isString()
    .withMessage('SMTP username must be a string')
    .trim(),
  
  body('smtpPassword')
    .optional()
    .isString()
    .withMessage('SMTP password must be a string'),
  
  body('smtpEncryption')
    .optional()
    .isIn(['tls', 'ssl', 'none'])
    .withMessage('SMTP encryption must be one of: tls, ssl, none'),
  
  body('sendgridApiKey')
    .optional()
    .isString()
    .withMessage('SendGrid API key must be a string'),
  
  body('mailjetApiKey')
    .optional()
    .isString()
    .withMessage('Mailjet API key must be a string'),
  
  body('mailjetSecretKey')
    .optional()
    .isString()
    .withMessage('Mailjet secret key must be a string'),
  
  body('emailSentFromName')
    .optional()
    .isString()
    .withMessage('Email sent from name must be a string')
    .trim(),
  
  body('emailSentFromEmail')
    .optional()
    .isEmail()
    .withMessage('Email sent from email must be a valid email address')
    .trim(),
  
  body('emailBody')
    .optional()
    .isString()
    .withMessage('Email body must be a string'),
  
  validate
];

// Validate SMS configuration update
export const validateSMSConfig = [
  body('smsMethod')
    .optional()
    .isIn(['nexmo', 'clickatell', 'message_bird', 'infobip'])
    .withMessage('SMS method must be one of: nexmo, clickatell, message_bird, infobip'),
  
  body('apiKey')
    .optional()
    .isString()
    .withMessage('API key must be a string'),
  
  body('apiSecret')
    .optional()
    .isString()
    .withMessage('API secret must be a string'),
  
  body('smsSentFrom')
    .optional()
    .isString()
    .withMessage('SMS sent from must be a string')
    .trim(),
  
  body('smsBody')
    .optional()
    .isString()
    .withMessage('SMS body must be a string'),
  
  validate
];

// Validate notification system configuration update
export const validateNotificationSystemConfig = [
  body('emailNotification')
    .optional()
    .isBoolean()
    .withMessage('Email notification must be a boolean'),
  
  body('smsNotification')
    .optional()
    .isBoolean()
    .withMessage('SMS notification must be a boolean'),
  
  body('languageOption')
    .optional()
    .isBoolean()
    .withMessage('Language option must be a boolean'),
  
  validate
];

// Validate send test email
export const validateSendTestEmail = [
  body('email')
    .notEmpty()
    .withMessage('Email address is required')
    .isEmail()
    .withMessage('Email address must be valid')
    .trim(),
  
  validate
];

// Validate send test SMS
export const validateSendTestSMS = [
  body('phone')
    .notEmpty()
    .withMessage('Phone number is required')
    .isString()
    .withMessage('Phone number must be a string')
    .trim(),
  
  validate
];

// Validate create email template
export const validateEmailTemplate = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .isString()
    .withMessage('Template name must be a string')
    .trim(),
  
  body('subject')
    .notEmpty()
    .withMessage('Email subject is required')
    .isString()
    .withMessage('Email subject must be a string')
    .trim(),
  
  body('body')
    .notEmpty()
    .withMessage('Email body is required')
    .isString()
    .withMessage('Email body must be a string'),
  
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),
  
  body('variables.*.name')
    .optional()
    .isString()
    .withMessage('Variable name must be a string'),
  
  body('variables.*.description')
    .optional()
    .isString()
    .withMessage('Variable description must be a string'),
  
  body('type')
    .optional()
    .isIn([
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
    ])
    .withMessage('Invalid template type'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),
  
  validate
];

// Validate create SMS template
export const validateSMSTemplate = [
  body('name')
    .notEmpty()
    .withMessage('Template name is required')
    .isString()
    .withMessage('Template name must be a string')
    .trim(),
  
  body('body')
    .notEmpty()
    .withMessage('SMS body is required')
    .isString()
    .withMessage('SMS body must be a string'),
  
  body('variables')
    .optional()
    .isArray()
    .withMessage('Variables must be an array'),
  
  body('variables.*.name')
    .optional()
    .isString()
    .withMessage('Variable name must be a string'),
  
  body('variables.*.description')
    .optional()
    .isString()
    .withMessage('Variable description must be a string'),
  
  body('type')
    .optional()
    .isIn([
      'user_registration',
      'order_confirmation',
      'shipping_confirmation',
      'delivery_confirmation',
      'otp_verification',
      'custom'
    ])
    .withMessage('Invalid template type'),
  
  body('isActive')
    .optional()
    .isBoolean()
    .withMessage('Is active must be a boolean'),
  
  validate
];

// Validate template ID
export const validateTemplateId = [
  param('id')
    .notEmpty()
    .withMessage('Template ID is required')
    .isMongoId()
    .withMessage('Template ID must be a valid MongoDB ObjectId'),
  
  validate
]; 