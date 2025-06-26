import { logger } from '../utils/logger.js';
import { AppError } from './errorHandler.js';

/**
 * Middleware to check if admin user has required permissions
 * @param {string} permission - The permission to check for
 * @returns {function} - Express middleware function
 */
export const checkAdminPermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource', 401));
    }

    // Check if this is an admin user
    if (!req.user.role || !['Admin', 'Manager', 'Support', 'Agent'].includes(req.user.role)) {
      return next(new AppError('This resource is restricted to admin users only', 403));
    }

    // If user is Super Admin, they have all permissions
    if (req.user.isSuperAdmin === true) {
      logger.info(`🔥 Super Admin ${req.user.email} granted permission: ${permission}`);
      return next();
    }

    // Check admin user permissions
    const permissions = req.user.permissions;

    logger.info(`🔍 Admin permission check for ${req.user.email}:`, {
      requestedPermission: permission,
      userRole: req.user.role,
      userDepartment: req.user.department,
      hasPermissionsProperty: !!permissions,
      permissionsType: typeof permissions,
      permissionsContent: permissions,
      isSuperAdmin: req.user.isSuperAdmin
    });

    if (!permissions || typeof permissions !== 'object') {
      logger.warn(`❌ Admin user ${req.user.email} has no permissions object`);
      return next(new AppError('You do not have permission to access this resource', 403));
    }

    // Check if the specific permission is granted (true value)
    if (permissions[permission] === true) {
      logger.info(`✅ Admin user ${req.user.email} has permission: ${permission}`);
      return next();
    }

    // For Manager users, check department-specific access
    if (req.user.role === 'Manager' && req.user.department) {
      const departmentPermissions = getDepartmentPermissions(req.user.department);
      if (departmentPermissions[permission] === true) {
        logger.info(`✅ Manager ${req.user.email} has department permission: ${permission} (${req.user.department})`);
        return next();
      }
    }

    logger.warn(`❌ Admin user ${req.user.email} denied permission: ${permission}`, {
      requestedPermission: permission,
      userPermissions: permissions,
      permissionValue: permissions[permission],
      availablePermissions: Object.keys(permissions).filter(key => permissions[key] === true),
      userRole: req.user.role,
      userDepartment: req.user.department
    });

    return next(new AppError('You do not have permission to access this resource', 403));
  };
};

/**
 * Middleware to check if admin user has any of the required permissions
 * @param {...string} permissions - The permissions to check for (any one will pass)
 * @returns {function} - Express middleware function
 */
export const checkAnyAdminPermission = (...permissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError('You must be logged in to access this resource', 401));
    }

    // Check if this is an admin user
    if (!req.user.role || !['Admin', 'Manager', 'Support', 'Agent'].includes(req.user.role)) {
      return next(new AppError('This resource is restricted to admin users only', 403));
    }

    // If user is Super Admin, they have all permissions
    if (req.user.isSuperAdmin === true) {
      logger.info(`🔥 Super Admin ${req.user.email} granted any permission from: [${permissions.join(', ')}]`);
      return next();
    }

    // Check admin user permissions
    const userPermissions = req.user.permissions;

    if (!userPermissions || typeof userPermissions !== 'object') {
      logger.warn(`❌ Admin user ${req.user.email} has no permissions object`);
      return next(new AppError('You do not have permission to access this resource', 403));
    }

    // Check if any of the permissions is granted
    const hasPermission = permissions.some(permission => userPermissions[permission] === true);

    if (hasPermission) {
      const grantedPermissions = permissions.filter(permission => userPermissions[permission] === true);
      logger.info(`✅ Admin user ${req.user.email} has permission(s): [${grantedPermissions.join(', ')}]`);
      return next();
    }

    // For Manager users, check department-specific access
    if (req.user.role === 'Manager' && req.user.department) {
      const departmentPermissions = getDepartmentPermissions(req.user.department);
      const hasDepartmentPermission = permissions.some(permission => departmentPermissions[permission] === true);

      if (hasDepartmentPermission) {
        const grantedPermissions = permissions.filter(permission => departmentPermissions[permission] === true);
        logger.info(`✅ Manager ${req.user.email} has department permission(s): [${grantedPermissions.join(', ')}] (${req.user.department})`);
        return next();
      }
    }

    logger.warn(`❌ Admin user ${req.user.email} denied permissions: [${permissions.join(', ')}]`, {
      requestedPermissions: permissions,
      userPermissions: userPermissions,
      availablePermissions: Object.keys(userPermissions).filter(key => userPermissions[key] === true),
      userRole: req.user.role,
      userDepartment: req.user.department
    });

    return next(new AppError('You do not have permission to access this resource', 403));
  };
};

/**
 * Get department-specific permissions for Manager role
 * @param {string} department - The department name
 * @returns {object} - Permission object with boolean values
 */
const getDepartmentPermissions = (department) => {
  const MANAGER_DEPARTMENT_PERMISSIONS = {
    "Operations": {
      // Core Access
      dashboardAccess: true,

      // Navigation Permissions
      usersAccess: false,
      teamsAccess: false,
      partnersAccess: false,
      ordersAccess: true,
      shipmentsAccess: true,
      ticketsAccess: false,
      ndrAccess: true,
      billingAccess: false,
      reportsAccess: true,
      escalationAccess: false,
      settingsAccess: false,

      // Granular Operation Permissions
      userManagement: false,
      teamManagement: false,
      ordersShipping: true,
      financialOperations: false,
      systemConfig: false,
      sellerManagement: false,
      supportTickets: false,
      reportsAnalytics: true,
      marketingPromotions: false
    },
    "Customer Support": {
      // Core Access
      dashboardAccess: true,

      // Navigation Permissions
      usersAccess: false,
      teamsAccess: false,
      partnersAccess: false,
      ordersAccess: false,
      shipmentsAccess: false,
      ticketsAccess: true,
      ndrAccess: false,
      billingAccess: false,
      reportsAccess: true,
      escalationAccess: true,
      settingsAccess: false,

      // Granular Operation Permissions
      userManagement: false,
      teamManagement: false,
      ordersShipping: false,
      financialOperations: false,
      systemConfig: false,
      sellerManagement: false,
      supportTickets: true,
      reportsAnalytics: true,
      marketingPromotions: false
    },
    "Sales & Business Development": {
      // Core Access
      dashboardAccess: true,

      // Navigation Permissions
      usersAccess: false,
      teamsAccess: false,
      partnersAccess: true,
      ordersAccess: false,
      shipmentsAccess: false,
      ticketsAccess: false,
      ndrAccess: false,
      billingAccess: false,
      reportsAccess: true,
      escalationAccess: false,
      settingsAccess: false,

      // Granular Operation Permissions
      userManagement: false,
      teamManagement: false,
      ordersShipping: false,
      financialOperations: false,
      systemConfig: false,
      sellerManagement: true,
      supportTickets: false,
      reportsAnalytics: true,
      marketingPromotions: true
    },
    "Accounts & Finance": {
      // Core Access
      dashboardAccess: true,

      // Navigation Permissions
      usersAccess: false,
      teamsAccess: false,
      partnersAccess: false,
      ordersAccess: false,
      shipmentsAccess: false,
      ticketsAccess: false,
      ndrAccess: false,
      billingAccess: true,
      reportsAccess: true,
      escalationAccess: false,
      settingsAccess: false,

      // Granular Operation Permissions
      userManagement: false,
      teamManagement: false,
      ordersShipping: false,
      financialOperations: true,
      systemConfig: false,
      sellerManagement: false,
      supportTickets: false,
      reportsAnalytics: true,
      marketingPromotions: false
    },
    "Logistics Coordination": {
      // Core Access
      dashboardAccess: true,

      // Navigation Permissions
      usersAccess: false,
      teamsAccess: false,
      partnersAccess: false,
      ordersAccess: true,
      shipmentsAccess: true,
      ticketsAccess: false,
      ndrAccess: true,
      billingAccess: false,
      reportsAccess: true,
      escalationAccess: false,
      settingsAccess: false,

      // Granular Operation Permissions
      userManagement: false,
      teamManagement: false,
      ordersShipping: true,
      financialOperations: false,
      systemConfig: false,
      sellerManagement: false,
      supportTickets: false,
      reportsAnalytics: true,
      marketingPromotions: false
    },
    "Warehouse Management": {
      // Core Access
      dashboardAccess: true,

      // Navigation Permissions
      usersAccess: false,
      teamsAccess: false,
      partnersAccess: false,
      ordersAccess: true,
      shipmentsAccess: true,
      ticketsAccess: false,
      ndrAccess: false,
      billingAccess: false,
      reportsAccess: true,
      escalationAccess: false,
      settingsAccess: false,

      // Granular Operation Permissions
      userManagement: false,
      teamManagement: false,
      ordersShipping: true,
      financialOperations: false,
      systemConfig: false,
      sellerManagement: false,
      supportTickets: false,
      reportsAnalytics: true,
      marketingPromotions: false
    },
    "IT Support": {
      // Core Access
      dashboardAccess: true,

      // Navigation Permissions
      usersAccess: false,
      teamsAccess: false,
      partnersAccess: false,
      ordersAccess: false,
      shipmentsAccess: false,
      ticketsAccess: false,
      ndrAccess: false,
      billingAccess: false,
      reportsAccess: true,
      escalationAccess: false,
      settingsAccess: true,

      // Granular Operation Permissions
      userManagement: false,
      teamManagement: false,
      ordersShipping: false,
      financialOperations: false,
      systemConfig: true,
      sellerManagement: false,
      supportTickets: false,
      reportsAnalytics: true,
      marketingPromotions: false
    }
  };

  return MANAGER_DEPARTMENT_PERMISSIONS[department] || {};
};

/**
 * Require Super Admin access only
 */
export const requireSuperAdmin = (req, res, next) => {
  if (!req.user) {
    return next(new AppError('You must be logged in to access this resource', 401));
  }

  if (req.user.isSuperAdmin !== true) {
    logger.warn(`❌ Super Admin access denied for ${req.user.email}`, {
      userRole: req.user.role,
      isSuperAdmin: req.user.isSuperAdmin
    });
    return next(new AppError('This resource requires Super Admin access', 403));
  }

  logger.info(`🔥 Super Admin access granted for ${req.user.email}`);
  next();
};
