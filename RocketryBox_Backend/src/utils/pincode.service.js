import Pincode from '../models/pincode.model.js';

/**
 * Get pincode details by pincode
 * @param {string} pincode - 6 digit pincode
 * @returns {Promise<Object>} - Pincode data
 */
export const getPincodeByValue = async (pincode) => {
  try {
    if (!pincode || pincode.length !== 6) {
      throw new Error('Invalid pincode. Must be a 6-digit value.');
    }
    
    const pincodeData = await Pincode.findOne({ pincode });
    if (!pincodeData) {
      throw new Error('Pincode not found');
    }
    
    return pincodeData;
  } catch (error) {
    throw error;
  }
};

/**
 * Search pincodes by district, state, or office name
 * @param {Object} query - Search parameters
 * @returns {Promise<Array>} - Array of pincodes matching criteria
 */
export const searchPincodes = async (query) => {
  try {
    const { district, state, officeName, pincode, limit = 50, page = 1 } = query;
    const skip = (page - 1) * limit;
    
    // Build search filters
    const filter = {};
    
    if (pincode) {
      // Partial pincode search (starts with)
      filter.pincode = { $regex: `^${pincode}`, $options: 'i' };
    }
    
    if (district) {
      filter.district = { $regex: district, $options: 'i' };
    }
    
    if (state) {
      filter.state = { $regex: state, $options: 'i' };
    }
    
    if (officeName) {
      filter.officeName = { $regex: officeName, $options: 'i' };
    }
    
    const pincodes = await Pincode.find(filter)
      .limit(parseInt(limit))
      .skip(skip);
      
    const totalResults = await Pincode.countDocuments(filter);
    
    return {
      pincodes,
      pagination: {
        totalResults,
        totalPages: Math.ceil(totalResults / limit),
        currentPage: page,
        limit
      }
    };
  } catch (error) {
    throw error;
  }
};

/**
 * Get all states with pincodes
 * @returns {Promise<Array>} - List of states
 */
export const getAllStates = async () => {
  try {
    const states = await Pincode.distinct('state');
    return states.sort();
  } catch (error) {
    throw error;
  }
};

/**
 * Get districts by state
 * @param {string} state - State name
 * @returns {Promise<Array>} - List of districts in the state
 */
export const getDistrictsByState = async (state) => {
  try {
    if (!state) {
      throw new Error('State parameter is required');
    }
    
    const districts = await Pincode.distinct('district', {
      state: { $regex: new RegExp(state, 'i') }
    });
    
    return districts.sort();
  } catch (error) {
    throw error;
  }
}; 