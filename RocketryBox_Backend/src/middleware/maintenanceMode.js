import MaintenanceSettings from '../modules/admin/models/maintenance.model.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to check if the system is in maintenance mode
 * If it is, requests are blocked except for:
 * 1. Whitelisted IPs
 * 2. Admin routes if allowAdminAccess is true
 * 3. The maintenance status endpoint
 */
export const checkMaintenanceMode = async (req, res, next) => {
  try {
    // Skip checking on maintenance status endpoint
    if (req.path === '/api/v2/admin/settings/maintenance/status') {
      return next();
    }
    
    // Get maintenance settings
    const settings = await MaintenanceSettings.getCurrentSettings();
    
    // Check if maintenance mode is enabled
    if (!settings.isEnabled) {
      return next();
    }
    
    // Check if current time is within maintenance window
    const now = new Date();
    if (settings.startTime && now < settings.startTime) {
      return next(); // Maintenance hasn't started yet
    }
    if (settings.endTime && now > settings.endTime) {
      return next(); // Maintenance has ended
    }
    
    // Get client IP
    const clientIP = req.ip || req.connection.remoteAddress;
    
    // Allow whitelisted IPs
    if (settings.isIPWhitelisted(clientIP)) {
      return next();
    }
    
    // Allow admin access if configured and request is to admin routes
    if (settings.allowAdminAccess && req.path.startsWith('/api/v2/admin')) {
      // Verify that it's an authenticated admin request
      if (req.user && req.user.role === 'admin') {
        return next();
      }
    }
    
    // Block the request with a 503 Service Unavailable response
    return next(new AppError(settings.message || 'System is under maintenance', 503));
  } catch (error) {
    // If there's an error checking maintenance mode, allow the request
    console.error('Error checking maintenance mode:', error);
    next();
  }
}; 