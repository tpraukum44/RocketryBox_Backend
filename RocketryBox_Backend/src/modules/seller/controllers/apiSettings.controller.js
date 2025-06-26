import APISettings from '../models/apiSettings.model.js';
import { AppError } from '../../../middleware/errorHandler.js';

// Get current API settings
export const getAPISettings = async (req, res, next) => {
  try {
    const settings = await APISettings.findOne({ seller: req.user.id });
    if (!settings) {
      // If no settings exist, create new ones
      const { apiKey, apiSecret } = APISettings.generateCredentials();
      const newSettings = await APISettings.create({
        seller: req.user.id,
        apiKey,
        apiSecret,
        status: 'active'
      });
      // Return both key and secret only on first creation
      res.status(201).json({
        success: true,
        data: {
          ...newSettings.toObject(),
          apiSecret
        }
      });
    } else {
      res.status(200).json({
        success: true,
        data: settings
      });
    }
  } catch (error) {
    next(error);
  }
};

// Generate new API credentials
export const generateNewCredentials = async (req, res, next) => {
  try {
    const { apiKey, apiSecret } = APISettings.generateCredentials();
    let settings = await APISettings.findOne({ seller: req.user.id });
    
    if (!settings) {
      settings = await APISettings.create({
        seller: req.user.id,
        apiKey,
        apiSecret,
        status: 'active'
      });
    } else {
      settings.apiKey = apiKey;
      settings.apiSecret = apiSecret;
      await settings.save();
    }

    // Return both key and secret only during generation
    res.status(200).json({
      success: true,
      data: {
        ...settings.toObject(),
        apiSecret
      },
      message: 'New API credentials generated successfully. Please save the API secret as it won\'t be shown again.'
    });
  } catch (error) {
    next(error);
  }
};

// Update API status (enable/disable)
export const updateAPIStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const settings = await APISettings.findOne({ seller: req.user.id });
    
    if (!settings) {
      throw new AppError('API settings not found. Generate credentials first.', 404);
    }

    settings.status = status;
    await settings.save();

    res.status(200).json({
      success: true,
      data: settings,
      message: `API access ${status === 'active' ? 'enabled' : 'disabled'} successfully`
    });
  } catch (error) {
    next(error);
  }
};

// Update last used timestamp (internal use)
export const updateLastUsed = async (sellerId) => {
  try {
    await APISettings.findOneAndUpdate(
      { seller: sellerId },
      { lastUsed: new Date() }
    );
  } catch (error) {
    console.error('Error updating API last used timestamp:', error);
  }
}; 