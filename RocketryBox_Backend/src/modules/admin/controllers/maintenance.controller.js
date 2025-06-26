import MaintenanceSettings from '../models/maintenance.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

// Get maintenance settings
export const getMaintenanceSettings = async (req, res, next) => {
  try {
    const settings = await MaintenanceSettings.getCurrentSettings();
    
    res.status(200).json({
      success: true,
      data: settings
    });
  } catch (error) {
    logger.error(`Error in getMaintenanceSettings: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update maintenance settings
export const updateMaintenanceSettings = async (req, res, next) => {
  try {
    const settings = await MaintenanceSettings.getCurrentSettings();
    
    // Update fields from request body
    const allowedFields = [
      'isEnabled', 'startTime', 'endTime', 'message', 'allowAdminAccess'
    ];
    
    allowedFields.forEach(field => {
      if (field in req.body) {
        settings[field] = req.body[field];
      }
    });
    
    // Set updatedBy
    settings.updatedBy = req.user.id;
    
    await settings.save();
    
    // Log maintenance mode changes
    if ('isEnabled' in req.body) {
      const action = req.body.isEnabled ? 'enabled' : 'disabled';
      logger.info(`Maintenance mode ${action} by admin ${req.user.id}`);
    }
    
    res.status(200).json({
      success: true,
      data: settings,
      message: 'Maintenance settings updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateMaintenanceSettings: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Add IP to whitelist
export const addWhitelistedIP = async (req, res, next) => {
  try {
    const { ip, description } = req.body;
    
    if (!ip) {
      return next(new AppError('IP address is required', 400));
    }
    
    const settings = await MaintenanceSettings.getCurrentSettings();
    
    // Add IP to whitelist
    settings.addIPToWhitelist(ip, description);
    
    // Set updatedBy
    settings.updatedBy = req.user.id;
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      data: settings.whitelistedIPs,
      message: `IP ${ip} added to whitelist successfully`
    });
  } catch (error) {
    logger.error(`Error in addWhitelistedIP: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Remove IP from whitelist
export const removeWhitelistedIP = async (req, res, next) => {
  try {
    const { ip } = req.params;
    
    const settings = await MaintenanceSettings.getCurrentSettings();
    
    // Check if IP exists in whitelist
    if (!settings.isIPWhitelisted(ip)) {
      return next(new AppError(`IP ${ip} not found in whitelist`, 404));
    }
    
    // Remove IP from whitelist
    settings.removeIPFromWhitelist(ip);
    
    // Set updatedBy
    settings.updatedBy = req.user.id;
    
    await settings.save();
    
    res.status(200).json({
      success: true,
      data: settings.whitelistedIPs,
      message: `IP ${ip} removed from whitelist successfully`
    });
  } catch (error) {
    logger.error(`Error in removeWhitelistedIP: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get maintenance status
export const getMaintenanceStatus = async (req, res, next) => {
  try {
    const settings = await MaintenanceSettings.getCurrentSettings();
    
    // Check if maintenance is currently active
    const now = new Date();
    const isActive = settings.isEnabled && 
      (!settings.startTime || now >= settings.startTime) && 
      (!settings.endTime || now <= settings.endTime);
    
    // Calculate remaining time if end time is set
    let remainingTime = null;
    if (isActive && settings.endTime && now <= settings.endTime) {
      remainingTime = Math.floor((settings.endTime - now) / 1000); // in seconds
    }
    
    res.status(200).json({
      success: true,
      data: {
        isActive,
        message: settings.message,
        startTime: settings.startTime,
        endTime: settings.endTime,
        remainingTime
      }
    });
  } catch (error) {
    logger.error(`Error in getMaintenanceStatus: ${error.message}`);
    next(new AppError(error.message, 500));
  }
}; 