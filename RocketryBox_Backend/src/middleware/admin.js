import { AppError } from './errorHandler.js';

// Middleware to check if the user is an admin
export const adminOnly = (req, res, next) => {
  if (!req.user || !req.user.role || req.user.role !== 'admin') {
    return next(new AppError('This route is restricted to admin users only', 403));
  }
  next();
};

// Middleware to check if the user is an admin or the resource owner
export const adminOrOwner = (idField = 'userId') => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('You must be logged in to access this resource', 401));
  }
  
  // Allow if admin
  if (req.user.role === 'admin') {
    return next();
  }
  
  // Allow if resource owner (ID matches)
  const resourceId = req.params.id || req.body[idField];
  if (resourceId && resourceId.toString() === req.user.id.toString()) {
    return next();
  }
  
  return next(new AppError('You do not have permission to perform this action', 403));
}; 