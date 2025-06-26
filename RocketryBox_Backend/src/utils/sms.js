import axios from 'axios';
import { logger } from './logger.js';

/**
 * Send SMS using Fast2SMS DLT route with approved templates
 * @param {Object} params
 * @param {string} params.to - Phone number to send SMS to
 * @param {string} params.message - Message text to send (for custom messages)
 * @param {string} params.type - Message type: 'otp', 'log', or 'ads'
 * @param {string} [params.variables] - Variables for DLT template (pipe-separated)
 * @returns {Promise<Object>} SMS sending result
 */
export const sendSMS = async ({ to, message, type, variables }) => {
  try {
    // Validate required parameters
    if (!to || !type) {
      throw new Error('Missing required parameters: to and type are required');
    }

    // Validate type
    const validTypes = ['otp', 'log', 'ads'];
    if (!validTypes.includes(type)) {
      throw new Error(`Invalid SMS type: ${type}. Valid types are: ${validTypes.join(', ')}`);
    }

    // Log SMS request in development mode for debugging
    if (process.env.NODE_ENV === 'development') {
      logger.info('Development mode: Sending actual SMS', {
        to: '***' + to.toString().slice(-4),
        type,
        variables: variables || 'none'
      });
    }

    // Validate API key
    if (!process.env.FAST2SMS_API_KEY) {
      throw new Error('FAST2SMS_API_KEY environment variable is not set');
    }

    // Get DLT configuration
    const dltConfig = getDLTConfig(type);
    if (!dltConfig) {
      throw new Error(`DLT template not available for type: ${type}. Available types: otp, log`);
    }

    // Format phone number (remove +91 if present)
    const phoneNumber = to.toString().replace('+91', '');

    // Prepare DLT request
    const requestBody = {
      route: 'dlt',
      sender_id: dltConfig.sender_id,
      message: dltConfig.message_id,
      variables_values: variables || '',
      numbers: phoneNumber
    };

    // Log request details for debugging (without sensitive data)
    logger.info('Sending DLT SMS request', {
      url: 'https://www.fast2sms.com/dev/bulkV2',
      type,
      senderId: dltConfig.sender_id,
      messageId: dltConfig.message_id,
      phoneNumber: '***' + phoneNumber.slice(-4),
      hasApiKey: !!process.env.FAST2SMS_API_KEY
    });

    // Make the API request to Fast2SMS - URL is hardcoded
    const response = await axios({
      method: 'POST',
      url: 'https://www.fast2sms.com/dev/bulkV2',
      headers: {
        'Content-Type': 'application/json',
        'authorization': process.env.FAST2SMS_API_KEY
      },
      data: requestBody
    });

    // Check if SMS was sent successfully
    if (response.data.return === true) {
      logger.info('DLT SMS sent successfully', {
        requestId: response.data.request_id,
        phoneNumber: '***' + phoneNumber.slice(-4),
        type,
        senderId: dltConfig.sender_id
      });

      return {
        success: true,
        requestId: response.data.request_id,
        message: 'DLT SMS sent successfully',
        route: 'dlt',
        senderId: dltConfig.sender_id
      };
    } else {
      throw new Error(response.data.message || 'Failed to send DLT SMS');
    }

  } catch (error) {
    logger.error('Error sending DLT SMS', {
      error: error.response?.data || error.message,
      phoneNumber: '***' + to.toString().slice(-4),
      type,
      stack: error.stack
    });

    // Don't bypass SMS errors - let them propagate properly

    throw new Error('Failed to send DLT SMS: ' + (error.response?.data?.message || error.message));
  }
};

/**
 * Get DLT configuration for message type
 * @param {string} type - Message type
 * @returns {Object|null} DLT configuration
 */
const getDLTConfig = (type) => {
  // DLT configurations with REAL Message IDs from Fast2SMS dashboard
  const dltConfigs = {
    'otp': {
      sender_id: 'RBXOTP',
      message_id: '184297', // ✅ WORKING Message ID from Fast2SMS dashboard
      template: 'Your OTP for {#VAR#} is {#VAR#}. It is valid for {#VAR#} minutes. Please do not share this OTP with anyone.',
      description: 'OTP verification template - DLT Compliant'
    },
    'log': {
      sender_id: 'RBXLOG',
      message_id: '184296', // ✅ WORKING Message ID from Fast2SMS dashboard
      template: 'Welcome to Rocketry Box! Your account has been successfully activated. User Name:{#VAR#} Password:{#VAR#}',
      description: 'Account activation template - DLT Compliant'
    }
    // Note: 'ads' type disabled due to "Invalid Language" error with Message ID 184295
  };

  return dltConfigs[type] || null;
};

/**
 * Send OTP SMS using DLT template
 * @param {string} to - Phone number
 * @param {string} otp - OTP code
 * @param {string} context - Context (e.g., 'Login', 'Registration')
 * @param {number} [minutes=5] - Validity in minutes
 * @returns {Promise<Object>} SMS result
 */
export const sendOTP = async (to, otp, context = 'verification', minutes = 5) => {
  // Format variables for DLT template: context|otp|minutes
  const variables = `RocketryBox ${context}|${otp}|${minutes}`;

  return await sendSMS({
    to,
    type: 'otp',
    variables
  });
};

/**
 * Send account activation SMS using DLT template
 * @param {string} to - Phone number
 * @param {string} username - Username
 * @param {string} password - Password
 * @returns {Promise<Object>} SMS result
 */
export const sendAccountActivation = async (to, username, password) => {
  // Format variables for DLT template: username|password
  const variables = `${username}|${password}`;

  return await sendSMS({
    to,
    type: 'log',
    variables
  });
};

/**
 * Send logistics update SMS (custom message since no DLT template available)
 * @param {string} to - Phone number
 * @param {string} trackingId - Tracking ID
 * @param {string} status - Shipment status
 * @param {string} [location] - Location (optional)
 * @returns {Promise<Object>} SMS result
 */
export const sendLogisticsUpdate = async (to, trackingId, status, location = '') => {
  // Since we don't have a logistics DLT template, use account activation template format
  // Format: Welcome message with tracking info
  let message = `Your RocketryBox shipment ${trackingId} has been ${status}`;
  if (location) {
    message += ` at ${location}`;
  }

  // Use the account activation template with custom variables
  const variables = `Shipment Update|${trackingId} - ${status}`;

  return await sendSMS({
    to,
    type: 'log',
    variables
  });
};

/**
 * Get available SMS types and their configurations
 * @returns {Array} Array of available SMS types
 */
export const getAvailableSMSTypes = () => {
  return [
    {
      type: 'otp',
      description: 'OTP and verification messages',
      route: 'DLT Compliant (₹0.25/SMS)',
      messageId: '184297',
      senderId: 'RBXOTP',
      template: 'Your OTP for {context} is {otp}. It is valid for {minutes} minutes.',
      variables: 'context|otp|minutes',
      cost: '₹0.25/SMS'
    },
    {
      type: 'log',
      description: 'Account activation and updates',
      route: 'DLT Compliant (₹0.25/SMS)',
      messageId: '184296',
      senderId: 'RBXLOG',
      template: 'Welcome to Rocketry Box! Account activated. User: {username} Pass: {password}',
      variables: 'username|password',
      cost: '₹0.25/SMS'
    }
  ];
};

// Predefined SMS templates
export const SMS_TEMPLATES = {
  OTP: {
    message: 'Your OTP for RocketryBox is {{otp}}. Valid for {{expiry}}. Do not share this OTP with anyone.'
  },
  TRACKING_UPDATE: {
    message: 'Your shipment {{trackingId}} has been {{status}} at {{location}}. Track your order on RocketryBox.'
  },
  ORDER_CONFIRMATION: {
    message: 'Your order #{{orderId}} has been confirmed. Track your shipment with tracking ID {{trackingId}} on RocketryBox.'
  },
  ORDER_CANCELLED: {
    message: 'Your order #{{orderNumber}} has been cancelled successfully. If you have any questions, please contact our support team.'
  },
  DELIVERY_CONFIRMATION: {
    message: 'Your order #{{orderId}} has been delivered. Thank you for using RocketryBox!'
  },
  PAYMENT_CONFIRMATION: {
    message: 'Payment of ₹{{amount}} received for order #{{orderId}}. Thank you for using RocketryBox!'
  }
};
