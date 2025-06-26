import mongoose from 'mongoose';
import { logger } from './logger.js';

// Counter schema for generating sequential user IDs
const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true },
  sequence: { type: Number, default: 0 }
});

const Counter = mongoose.model('Counter', counterSchema);

/**
 * Generate next sequential user ID with RB prefix
 * @param {string} type - 'customer' or 'seller'
 * @returns {Promise<string>} - Generated user ID (e.g., 'RBC001', 'RBS001')
 */
export const generateUserId = async (type) => {
  try {
    // Different prefixes for different user types
    const prefixes = {
      customer: 'RBC', // RocketryBox Customer
      seller: 'RBS'    // RocketryBox Seller
    };

    const prefix = prefixes[type] || 'RBU'; // RBU for unknown type
    const counterId = `${type}_id_counter`;

    // Find and increment counter atomically
    const counter = await Counter.findByIdAndUpdate(
      counterId,
      { $inc: { sequence: 1 } },
      { new: true, upsert: true }
    );

    // Format number with leading zeros (e.g., 001, 002, etc.)
    const paddedNumber = String(counter.sequence).padStart(3, '0');

    return `${prefix}${paddedNumber}`;
  } catch (error) {
    logger.error('Error generating user ID:', error);
    // Fallback to timestamp-based ID
    return `USER_${Date.now()}`;
  }
};

/**
 * Validate if a string is a valid RB user ID format
 * @param {string} userId - User ID to validate
 * @returns {boolean} - True if valid RB format
 */
export const isValidRBUserId = (userId) => {
  if (!userId || typeof userId !== 'string') return false;

  // Check format: RBC/RBS followed by 3+ digits
  const rbPattern = /^RB[CS]\d{3,}$/;
  return rbPattern.test(userId);
};

/**
 * Extract user type from RB user ID
 * @param {string} userId - RB user ID
 * @returns {string|null} - 'customer', 'seller', or null
 */
export const getUserTypeFromRBId = (userId) => {
  if (!isValidRBUserId(userId)) return null;

  if (userId.startsWith('RBC')) return 'customer';
  if (userId.startsWith('RBS')) return 'seller';
  return null;
};

/**
 * Reset counter for testing purposes
 * @param {string} type - 'customer' or 'seller'
 */
export const resetUserIdCounter = async (type) => {
  const counterId = `${type}_id_counter`;
  await Counter.findByIdAndUpdate(
    counterId,
    { sequence: 0 },
    { upsert: true }
  );
};
