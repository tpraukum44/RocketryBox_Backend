import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import Config from '../models/config.model.js';

/**
 * Get all system configurations
 * @route GET /api/v2/admin/config
 * @access Private (Admin only)
 */
export const getAllConfigs = async (req, res, next) => {
  try {
    const configs = await Config.find({});
    
    // Group configurations by category
    const groupedConfigs = configs.reduce((acc, config) => {
      if (!acc[config.category]) {
        acc[config.category] = [];
      }
      acc[config.category].push(config);
      return acc;
    }, {});

    res.status(200).json({
      success: true,
      data: groupedConfigs
    });
  } catch (error) {
    logger.error(`Error in getAllConfigs: ${error.message}`);
    next(new AppError('Failed to fetch configurations', 500));
  }
};

/**
 * Get configuration by key
 * @route GET /api/v2/admin/config/:key
 * @access Private (Admin only)
 */
export const getConfigByKey = async (req, res, next) => {
  try {
    const { key } = req.params;
    
    const config = await Config.findOne({ key });
    
    if (!config) {
      return next(new AppError('Configuration not found', 404));
    }

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error(`Error in getConfigByKey: ${error.message}`);
    next(new AppError('Failed to fetch configuration', 500));
  }
};

/**
 * Update configuration
 * @route PATCH /api/v2/admin/config/:key
 * @access Private (Admin only)
 */
export const updateConfig = async (req, res, next) => {
  try {
    const { key } = req.params;
    const { value, description } = req.body;
    
    let config = await Config.findOne({ key });
    
    if (!config) {
      return next(new AppError('Configuration not found', 404));
    }
    
    // Update config
    config.value = value;
    if (description) config.description = description;
    
    // Add to history
    config.history = config.history || [];
    config.history.push({
      value,
      updatedBy: req.user.id,
      updatedAt: new Date()
    });
    
    await config.save();
    
    // Log the update
    logger.info(`Admin ${req.user.id} updated configuration ${key}`);

    res.status(200).json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error(`Error in updateConfig: ${error.message}`);
    next(new AppError('Failed to update configuration', 500));
  }
};

/**
 * Create a new configuration
 * @route POST /api/v2/admin/config
 * @access Private (Admin only)
 */
export const createConfig = async (req, res, next) => {
  try {
    const { key, value, description, category, type } = req.body;
    
    // Check if configuration with this key already exists
    const existingConfig = await Config.findOne({ key });
    
    if (existingConfig) {
      return next(new AppError('Configuration with this key already exists', 400));
    }
    
    // Create new config
    const config = await Config.create({
      key,
      value,
      description,
      category: category || 'General',
      type: type || 'String',
      history: [
        {
          value,
          updatedBy: req.user.id,
          updatedAt: new Date()
        }
      ]
    });
    
    // Log the creation
    logger.info(`Admin ${req.user.id} created new configuration ${key}`);

    res.status(201).json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error(`Error in createConfig: ${error.message}`);
    next(new AppError('Failed to create configuration', 500));
  }
};

/**
 * Delete configuration
 * @route DELETE /api/v2/admin/config/:key
 * @access Private (Admin only)
 */
export const deleteConfig = async (req, res, next) => {
  try {
    const { key } = req.params;
    
    const config = await Config.findOne({ key });
    
    if (!config) {
      return next(new AppError('Configuration not found', 404));
    }
    
    // Check if configuration is system critical
    if (config.isSystemCritical) {
      return next(new AppError('Cannot delete system critical configuration', 403));
    }
    
    await Config.deleteOne({ key });
    
    // Log the deletion
    logger.info(`Admin ${req.user.id} deleted configuration ${key}`);

    res.status(200).json({
      success: true,
      message: 'Configuration deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deleteConfig: ${error.message}`);
    next(new AppError('Failed to delete configuration', 500));
  }
};

/**
 * Get configuration history
 * @route GET /api/v2/admin/config/:key/history
 * @access Private (Admin only)
 */
export const getConfigHistory = async (req, res, next) => {
  try {
    const { key } = req.params;
    
    const config = await Config.findOne({ key })
      .populate({
        path: 'history.updatedBy',
        model: 'Admin',
        select: 'fullName email'
      });
    
    if (!config) {
      return next(new AppError('Configuration not found', 404));
    }

    res.status(200).json({
      success: true,
      data: config.history || []
    });
  } catch (error) {
    logger.error(`Error in getConfigHistory: ${error.message}`);
    next(new AppError('Failed to fetch configuration history', 500));
  }
}; 