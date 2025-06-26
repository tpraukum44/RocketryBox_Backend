import { getPincodeByValue, searchPincodes, getAllStates, getDistrictsByState } from '../../../utils/pincode.service.js';

/**
 * Get pincode details by pincode
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getPincodeDetails = async (req, res) => {
  try {
    const { pincode } = req.params;
    const pincodeData = await getPincodeByValue(pincode);
    return res.status(200).json({
      success: true,
      data: pincodeData
    });
  } catch (error) {
    return res.status(error.message === 'Pincode not found' ? 404 : 400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Search pincodes with various parameters
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const searchPincodeData = async (req, res) => {
  try {
    const result = await searchPincodes(req.query);
    return res.status(200).json({
      success: true,
      ...result
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get list of all states
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getStates = async (req, res) => {
  try {
    const states = await getAllStates();
    return res.status(200).json({
      success: true,
      data: states
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Get districts by state
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 */
export const getDistricts = async (req, res) => {
  try {
    const { state } = req.params;
    const districts = await getDistrictsByState(state);
    return res.status(200).json({
      success: true,
      data: districts
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
}; 