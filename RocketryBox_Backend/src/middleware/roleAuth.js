import { logger } from '../utils/logger.js';

/**
 * Role-based authorization middleware
 * Checks if the authenticated user has the required role(s)
 */
export const authorizeRoles = (allowedRoles = []) => {
  return (req, res, next) => {
    try {
      // Check if user is authenticated (should be set by authenticateToken middleware)
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
      }

      // Get user role from the authenticated user
      const userRole = req.user.role;

      if (!userRole) {
        logger.warn('User role not found in token:', {
          userId: req.user.id,
          email: req.user.email
        });
        return res.status(403).json({
          success: false,
          error: 'User role not found'
        });
      }

      // Check if user role is in the allowed roles
      if (!allowedRoles.includes(userRole)) {
        logger.warn('Access denied - insufficient permissions:', {
          userId: req.user.id,
          userRole: userRole,
          requiredRoles: allowedRoles,
          endpoint: req.path
        });
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          details: {
            userRole: userRole,
            requiredRoles: allowedRoles
          }
        });
      }

      // User has required role, proceed to next middleware
      logger.debug('Role authorization successful:', {
        userId: req.user.id,
        userRole: userRole,
        endpoint: req.path
      });
      
      next();
    } catch (error) {
      logger.error('Role authorization error:', {
        error: error.message,
        stack: error.stack,
        userId: req.user?.id
      });
      
      res.status(500).json({
        success: false,
        error: 'Authorization check failed'
      });
    }
  };
};

/**
 * Check if user is admin (admin or super_admin)
 */
export const requireAdmin = authorizeRoles(['admin', 'super_admin']);

/**
 * Check if user is super admin
 */
export const requireSuperAdmin = authorizeRoles(['super_admin']);

/**
 * Check if user is seller
 */
export const requireSeller = authorizeRoles(['seller']);

/**
 * Check if user is customer
 */
export const requireCustomer = authorizeRoles(['customer']);

/**
 * Check if user is seller or admin
 */
export const requireSellerOrAdmin = authorizeRoles(['seller', 'admin', 'super_admin']);

export default {
  authorizeRoles,
  requireAdmin,
  requireSuperAdmin,
  requireSeller,
  requireCustomer,
  requireSellerOrAdmin
}; 