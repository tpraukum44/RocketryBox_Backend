import { AppError } from './errorHandler.js';

/**
 * Middleware to check if user has required permissions
 * @param {string} permission - The permission to check for
 * @returns {function} - Express middleware function
 */
export const checkPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource', 401));
    }

    // If user is superAdmin, they have all permissions
    if (req.user.isSuperAdmin === true) {
      return next();
    }

    // If user is a regular seller, they have all permissions
    if (req.user.role === 'seller') {
      return next();
    }

    // Handle team user permissions (stored as object)
    if (req.user.role === 'team_user') {
      const permissions = req.user.permissions;

      console.log(`🔍 DEBUG: Team user permission check for ${req.user.email}:`, {
        requestedPermission: permission,
        hasPermissionsProperty: !!permissions,
        permissionsType: typeof permissions,
        permissionsContent: permissions,
        userObject: {
          id: req.user.id,
          email: req.user.email,
          role: req.user.role,
          name: req.user.name
        }
      });

      if (!permissions || typeof permissions !== 'object') {
        console.warn('❌ Team user has no permissions object:', req.user.email);
        return next(new AppError('You do not have permission to access this resource', 403));
      }

      // Check if the specific permission is granted (true value)
      // First try exact match
      if (permissions[permission] === true) {
        console.log(`✅ Team user ${req.user.email} has permission: ${permission}`);
        return next();
      }

      // Try case-insensitive match
      const permissionKeys = Object.keys(permissions);
      const matchedKey = permissionKeys.find(key =>
        key.toLowerCase().trim() === permission.toLowerCase().trim()
      );

      if (matchedKey && permissions[matchedKey] === true) {
        console.log(`✅ Team user ${req.user.email} has permission (case-insensitive): ${permission} (matched: ${matchedKey})`);
        return next();
      }

      console.log(`❌ Team user ${req.user.email} denied permission: ${permission}`, {
        requestedPermission: permission,
        userPermissions: permissions,
        permissionValue: permissions[permission],
        availablePermissions: permissionKeys,
        caseInsensitiveMatch: matchedKey
      });
      return next(new AppError('You do not have permission to access this resource', 403));
    }

    // Handle admin users (permissions as array)
    const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];

    // For admin users, check if they have the specific permission
    if ((req.user.role === 'Admin' || req.user.role === 'Manager') && userPermissions.length > 0) {
      if (userPermissions.includes(permission) || userPermissions.includes('all')) {
        return next();
      }
    }

    // For other roles, check their specific permissions
    if (userPermissions.length > 0 && (userPermissions.includes(permission) || userPermissions.includes('all'))) {
      return next();
    }

    return next(new AppError('You do not have permission to access this resource', 403));
  };
};

/**
 * Middleware to check if user has any of the required permissions
 * @param {...string} permissions - The permissions to check for (any one will pass)
 * @returns {function} - Express middleware function
 */
export const checkAnyPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource', 401));
    }

    // If user is superAdmin, they have all permissions
    if (req.user.isSuperAdmin === true) {
      return next();
    }

    // If user is a regular seller, they have all permissions
    if (req.user.role === 'seller') {
      return next();
    }

    // Handle team user permissions (stored as object)
    if (req.user.role === 'team_user') {
      const userPermissions = req.user.permissions;

      if (!userPermissions || typeof userPermissions !== 'object') {
        return next(new AppError('You do not have permission to access this resource', 403));
      }

      // Check if any of the permissions is granted
      const hasPermission = permissions.some(permission => userPermissions[permission] === true);

      if (hasPermission) {
        return next();
      }

      return next(new AppError('You do not have permission to access this resource', 403));
    }

    // Handle admin users (permissions as array)
    const userPermissions = Array.isArray(req.user.permissions) ? req.user.permissions : [];

    if (userPermissions.length > 0) {
      const hasPermission = permissions.some(permission =>
        userPermissions.includes(permission) || userPermissions.includes('all')
      );

      if (hasPermission) {
        return next();
      }
    }

    return next(new AppError('You do not have permission to access this resource', 403));
  };
};
