import Pincode from '../models/pincode.model.js';
import { logger } from './logger.js';

export async function getPincodeDetails(pincode) {
  try {
    // First, try to get from database
    const pincodeData = await Pincode.findOne({ pincode: pincode.toString() });

    if (pincodeData) {
      return pincodeData;
    }

    // If not found in database, validate format and create basic fallback data
    const pincodeStr = pincode.toString();

    // Basic pincode validation (6 digits)
    if (!/^\d{6}$/.test(pincodeStr)) {
      return null; // Invalid pincode format
    }

    // Create basic fallback data for valid pincode format
    // This allows the system to work without a complete pincode database
    const fallbackData = {
      pincode: pincodeStr,
      officeName: 'Unknown',
      district: 'Unknown',
      state: 'Unknown',
      region: 'Unknown',
      circle: 'Unknown',
      taluk: 'Unknown',
      _isFallback: true // Flag to indicate this is fallback data
    };

    // Optionally save to database for future use
    try {
      const newPincode = new Pincode(fallbackData);
      await newPincode.save();
      return newPincode;
    } catch (error) {
      // If save fails (e.g., duplicate), just return the fallback data
      return fallbackData;
    }

  } catch (error) {
    logger.error('Error in getPincodeDetails:', error);
    return null;
  }
}
