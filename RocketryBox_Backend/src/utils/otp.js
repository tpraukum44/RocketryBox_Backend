import crypto from 'crypto';
import { setOTP } from './redis.js';

/**
 * Generate a random OTP of specified length
 * @param {number} length - Length of the OTP (default: 6)
 * @returns {string} - Generated OTP
 */
export const generateOTP = (length = 6) => {
  const digits = '0123456789';
  let otp = '';
  
  // Generate random bytes
  const randomBytes = crypto.randomBytes(length);
  
  // Convert random bytes to OTP
  for (let i = 0; i < length; i++) {
    const randomIndex = randomBytes[i] % digits.length;
    otp += digits[randomIndex];
  }
  
  return otp;
};

/**
 * Store OTP in Redis
 * @param {string} userId - User ID or identifier
 * @param {string} otp - Generated OTP
 * @param {number} expiryInSeconds - Expiry time in seconds
 * @returns {Promise<boolean>} - Whether OTP was stored successfully
 */
export const storeOTP = async (userId, otp, expiryInSeconds = 300) => {
  return await setOTP(userId, otp, expiryInSeconds);
};

/**
 * Validate if an OTP is expired
 * @param {Date} expiryTime - OTP expiry timestamp
 * @returns {boolean} - Whether OTP is expired
 */
export const isOTPExpired = (expiryTime) => {
  return Date.now() > expiryTime;
};

/**
 * Validate if an OTP matches
 * @param {string} inputOTP - OTP entered by user
 * @param {string} storedOTP - OTP stored in database
 * @param {Date} expiryTime - OTP expiry timestamp
 * @returns {boolean} - Whether OTP is valid
 */
export const validateOTP = (inputOTP, storedOTP, expiryTime) => {
  if (!inputOTP || !storedOTP || !expiryTime) {
    return false;
  }
  
  if (isOTPExpired(expiryTime)) {
    return false;
  }
  
  return inputOTP === storedOTP;
};

// Alias for backward compatibility
export const verifyOTP = validateOTP; 