import { logger } from '../utils/logger.js';

/**
 * Professional shipping error handler
 * Provides clear, actionable error messages for shipping operations
 */
export class ShippingError extends Error {
  constructor(message, code, partner, details = {}) {
    super(message);
    this.name = 'ShippingError';
    this.code = code;
    this.partner = partner;
    this.details = details;
    this.timestamp = new Date().toISOString();
  }
}

/**
 * Error codes for different shipping scenarios
 */
export const SHIPPING_ERROR_CODES = {
  // Authentication errors
  AUTH_FAILED: 'SHIPPING_AUTH_FAILED',
  CREDENTIALS_INVALID: 'SHIPPING_CREDENTIALS_INVALID',
  API_ACCESS_DENIED: 'SHIPPING_API_ACCESS_DENIED',
  
  // Service errors
  SERVICE_UNAVAILABLE: 'SHIPPING_SERVICE_UNAVAILABLE',
  ENDPOINT_NOT_FOUND: 'SHIPPING_ENDPOINT_NOT_FOUND',
  RATE_CALCULATION_FAILED: 'SHIPPING_RATE_CALCULATION_FAILED',
  BOOKING_FAILED: 'SHIPPING_BOOKING_FAILED',
  TRACKING_FAILED: 'SHIPPING_TRACKING_FAILED',
  
  // Validation errors
  INVALID_PINCODE: 'SHIPPING_INVALID_PINCODE',
  INVALID_WEIGHT: 'SHIPPING_INVALID_WEIGHT',
  INVALID_DIMENSIONS: 'SHIPPING_INVALID_DIMENSIONS',
  MISSING_REQUIRED_FIELDS: 'SHIPPING_MISSING_REQUIRED_FIELDS',
  
  // Network errors
  NETWORK_ERROR: 'SHIPPING_NETWORK_ERROR',
  TIMEOUT_ERROR: 'SHIPPING_TIMEOUT_ERROR',
  
  // Configuration errors
  CONFIG_ERROR: 'SHIPPING_CONFIG_ERROR',
  PARTNER_NOT_CONFIGURED: 'SHIPPING_PARTNER_NOT_CONFIGURED'
};

/**
 * Create a standardized shipping error
 */
export const createShippingError = (message, code, partner, details = {}) => {
  return new ShippingError(message, code, partner, details);
};

/**
 * Handle BlueDart specific errors
 */
export const handleBlueDartError = (error, operation = 'operation') => {
  logger.error(`BlueDart ${operation} error:`, {
    message: error.message,
    status: error.response?.status,
    data: error.response?.data
  });

  if (error.response) {
    const status = error.response.status;
    
    switch (status) {
      case 404:
        throw createShippingError(
          'BlueDart API service is currently unavailable. Please contact support or try again later.',
          SHIPPING_ERROR_CODES.ENDPOINT_NOT_FOUND,
          'BlueDart',
          { 
            httpStatus: status,
            operation,
            suggestion: 'Contact BlueDart support to verify API endpoint availability'
          }
        );
        
      case 401:
      case 403:
        throw createShippingError(
          'BlueDart API authentication failed. Please verify your API credentials.',
          SHIPPING_ERROR_CODES.AUTH_FAILED,
          'BlueDart',
          { 
            httpStatus: status,
            operation,
            suggestion: 'Verify BLUEDART_USER and BLUEDART_LICENSE_KEY in environment configuration'
          }
        );
        
      case 400:
        throw createShippingError(
          'Invalid request data sent to BlueDart API. Please check the shipment details.',
          SHIPPING_ERROR_CODES.RATE_CALCULATION_FAILED,
          'BlueDart',
          { 
            httpStatus: status,
            operation,
            suggestion: 'Verify pincode, weight, and dimensions are valid'
          }
        );
        
      case 500:
      case 502:
      case 503:
        throw createShippingError(
          'BlueDart API is experiencing technical difficulties. Please try again later.',
          SHIPPING_ERROR_CODES.SERVICE_UNAVAILABLE,
          'BlueDart',
          { 
            httpStatus: status,
            operation,
            suggestion: 'Wait a few minutes and retry the operation'
          }
        );
        
      default:
        throw createShippingError(
          `BlueDart API returned an unexpected error (${status}). Please contact support.`,
          SHIPPING_ERROR_CODES.SERVICE_UNAVAILABLE,
          'BlueDart',
          { 
            httpStatus: status,
            operation,
            suggestion: 'Contact technical support with this error code'
          }
        );
    }
  } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
    throw createShippingError(
      'Unable to connect to BlueDart API. Please check your internet connection.',
      SHIPPING_ERROR_CODES.NETWORK_ERROR,
      'BlueDart',
      { 
        networkError: error.code,
        operation,
        suggestion: 'Check internet connectivity and firewall settings'
      }
    );
  } else if (error.code === 'ECONNABORTED') {
    throw createShippingError(
      'BlueDart API request timed out. Please try again.',
      SHIPPING_ERROR_CODES.TIMEOUT_ERROR,
      'BlueDart',
      { 
        operation,
        suggestion: 'Retry the operation or contact support if the issue persists'
      }
    );
  } else {
    throw createShippingError(
      `BlueDart ${operation} failed: ${error.message}`,
      SHIPPING_ERROR_CODES.SERVICE_UNAVAILABLE,
      'BlueDart',
      { 
        originalError: error.message,
        operation,
        suggestion: 'Contact technical support for assistance'
      }
    );
  }
};

/**
 * Format shipping error for API response
 */
export const formatShippingErrorResponse = (error) => {
  if (error instanceof ShippingError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        partner: error.partner,
        timestamp: error.timestamp,
        details: error.details
      }
    };
  }
  
  // Handle generic errors
  return {
    success: false,
    error: {
      message: error.message || 'An unexpected shipping error occurred',
      code: SHIPPING_ERROR_CODES.SERVICE_UNAVAILABLE,
      partner: 'Unknown',
      timestamp: new Date().toISOString(),
      details: {
        suggestion: 'Contact technical support for assistance'
      }
    }
  };
};

/**
 * Middleware to handle shipping errors in Express routes
 */
export const shippingErrorMiddleware = (error, req, res, next) => {
  if (error instanceof ShippingError) {
    logger.error('Shipping operation failed:', {
      code: error.code,
      partner: error.partner,
      message: error.message,
      details: error.details,
      url: req.url,
      method: req.method
    });
    
    return res.status(400).json(formatShippingErrorResponse(error));
  }
  
  // Pass non-shipping errors to the next error handler
  next(error);
};

export default {
  ShippingError,
  SHIPPING_ERROR_CODES,
  createShippingError,
  handleBlueDartError,
  formatShippingErrorResponse,
  shippingErrorMiddleware
}; 