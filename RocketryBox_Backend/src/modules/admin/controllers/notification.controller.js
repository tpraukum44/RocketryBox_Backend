import { 
  EmailConfig, 
  SMSConfig, 
  NotificationSystemConfig,
  EmailTemplate,
  SMSTemplate
} from '../models/notification.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

// Get email configuration
export const getEmailConfig = async (req, res, next) => {
  try {
    // Get email configuration or create default if not exists
    let emailConfig = await EmailConfig.findOne();
    
    if (!emailConfig) {
      emailConfig = await EmailConfig.create({
        emailMethod: 'smtp',
        smtpHost: 'smtp.example.com',
        smtpPort: 587,
        smtpUsername: 'user@example.com',
        smtpEncryption: 'tls',
        emailSentFromName: 'RocketryBox',
        emailSentFromEmail: 'noreply@rocketrybox.com'
      });
    }
    
    res.status(200).json({
      success: true,
      data: emailConfig
    });
  } catch (error) {
    logger.error(`Error in getEmailConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update email configuration
export const updateEmailConfig = async (req, res, next) => {
  try {
    let emailConfig = await EmailConfig.findOne();
    
    if (!emailConfig) {
      emailConfig = new EmailConfig();
    }
    
    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key in emailConfig) {
        emailConfig[key] = req.body[key];
      }
    });
    
    // Set updatedBy
    emailConfig.updatedBy = req.user.id;
    
    await emailConfig.save();
    
    res.status(200).json({
      success: true,
      data: emailConfig,
      message: 'Email configuration updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateEmailConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get SMS configuration
export const getSMSConfig = async (req, res, next) => {
  try {
    // Get SMS configuration or create default if not exists
    let smsConfig = await SMSConfig.findOne();
    
    if (!smsConfig) {
      smsConfig = await SMSConfig.create({
        smsMethod: 'nexmo',
        smsSentFrom: 'RocketryBox'
      });
    }
    
    res.status(200).json({
      success: true,
      data: smsConfig
    });
  } catch (error) {
    logger.error(`Error in getSMSConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update SMS configuration
export const updateSMSConfig = async (req, res, next) => {
  try {
    let smsConfig = await SMSConfig.findOne();
    
    if (!smsConfig) {
      smsConfig = new SMSConfig();
    }
    
    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key in smsConfig) {
        smsConfig[key] = req.body[key];
      }
    });
    
    // Set updatedBy
    smsConfig.updatedBy = req.user.id;
    
    await smsConfig.save();
    
    res.status(200).json({
      success: true,
      data: smsConfig,
      message: 'SMS configuration updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateSMSConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get notification system config
export const getNotificationSystemConfig = async (req, res, next) => {
  try {
    // Get notification system config or create default if not exists
    let config = await NotificationSystemConfig.findOne();
    
    if (!config) {
      config = await NotificationSystemConfig.create({
        emailNotification: true,
        smsNotification: false,
        languageOption: false
      });
    }
    
    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error(`Error in getNotificationSystemConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update notification system config
export const updateNotificationSystemConfig = async (req, res, next) => {
  try {
    let config = await NotificationSystemConfig.findOne();
    
    if (!config) {
      config = new NotificationSystemConfig();
    }
    
    // Update fields
    Object.keys(req.body).forEach(key => {
      if (key in config) {
        config[key] = req.body[key];
      }
    });
    
    // Set updatedBy
    config.updatedBy = req.user.id;
    
    await config.save();
    
    res.status(200).json({
      success: true,
      data: config,
      message: 'Notification system configuration updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateNotificationSystemConfig: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Send test email
export const sendTestEmail = async (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return next(new AppError('Email address is required', 400));
    }
    
    // Here you would implement the actual email sending logic
    // This is a mock implementation
    
    res.status(200).json({
      success: true,
      message: `Test email sent to ${email}`
    });
  } catch (error) {
    logger.error(`Error in sendTestEmail: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Send test SMS
export const sendTestSMS = async (req, res, next) => {
  try {
    const { phone } = req.body;
    
    if (!phone) {
      return next(new AppError('Phone number is required', 400));
    }
    
    // Here you would implement the actual SMS sending logic
    // This is a mock implementation
    
    res.status(200).json({
      success: true,
      message: `Test SMS sent to ${phone}`
    });
  } catch (error) {
    logger.error(`Error in sendTestSMS: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Email templates

// List email templates
export const listEmailTemplates = async (req, res, next) => {
  try {
    const templates = await EmailTemplate.find()
      .sort({ updatedAt: -1 })
      .select('name type subject isActive updatedAt');
    
    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error(`Error in listEmailTemplates: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get email template by ID
export const getEmailTemplateById = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findById(req.params.id);
    
    if (!template) {
      return next(new AppError('Email template not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Error in getEmailTemplateById: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Create email template
export const createEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.create({
      ...req.body,
      updatedBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Error in createEmailTemplate: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update email template
export const updateEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        updatedBy: req.user.id 
      },
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return next(new AppError('Email template not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Error in updateEmailTemplate: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Delete email template
export const deleteEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findByIdAndDelete(req.params.id);
    
    if (!template) {
      return next(new AppError('Email template not found', 404));
    }
    
    res.status(200).json({
      success: true,
      message: 'Email template deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deleteEmailTemplate: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// SMS templates

// List SMS templates
export const listSMSTemplates = async (req, res, next) => {
  try {
    const templates = await SMSTemplate.find()
      .sort({ updatedAt: -1 })
      .select('name type isActive updatedAt');
    
    res.status(200).json({
      success: true,
      data: templates
    });
  } catch (error) {
    logger.error(`Error in listSMSTemplates: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get SMS template by ID
export const getSMSTemplateById = async (req, res, next) => {
  try {
    const template = await SMSTemplate.findById(req.params.id);
    
    if (!template) {
      return next(new AppError('SMS template not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Error in getSMSTemplateById: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Create SMS template
export const createSMSTemplate = async (req, res, next) => {
  try {
    const template = await SMSTemplate.create({
      ...req.body,
      updatedBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Error in createSMSTemplate: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update SMS template
export const updateSMSTemplate = async (req, res, next) => {
  try {
    const template = await SMSTemplate.findByIdAndUpdate(
      req.params.id,
      { 
        ...req.body,
        updatedBy: req.user.id 
      },
      { new: true, runValidators: true }
    );
    
    if (!template) {
      return next(new AppError('SMS template not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: template
    });
  } catch (error) {
    logger.error(`Error in updateSMSTemplate: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Delete SMS template
export const deleteSMSTemplate = async (req, res, next) => {
  try {
    const template = await SMSTemplate.findByIdAndDelete(req.params.id);
    
    if (!template) {
      return next(new AppError('SMS template not found', 404));
    }
    
    res.status(200).json({
      success: true,
      message: 'SMS template deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deleteSMSTemplate: ${error.message}`);
    next(new AppError(error.message, 500));
  }
}; 