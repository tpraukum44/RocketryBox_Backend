import Policy from '../models/policy.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';

// List all policies with pagination
export const listPolicies = async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    
    const total = await Policy.countDocuments();
    const policies = await Policy.find()
      .sort({ updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    
    res.status(200).json({
      success: true,
      data: policies,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error in listPolicies: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get policy by slug
export const getPolicyBySlug = async (req, res, next) => {
  try {
    const policy = await Policy.findOne({ slug: req.params.slug });
    
    if (!policy) {
      return next(new AppError('Policy not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    logger.error(`Error in getPolicyBySlug: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get policy by type
export const getPolicyByType = async (req, res, next) => {
  try {
    const policy = await Policy.findOne({ 
      type: req.params.type,
      status: 'published',
      isDefault: true
    });
    
    if (!policy) {
      return next(new AppError('Policy not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    logger.error(`Error in getPolicyByType: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get all default policies
export const getDefaultPolicies = async (req, res, next) => {
  try {
    const policies = await Policy.find({ 
      isDefault: true,
      status: 'published'
    });
    
    res.status(200).json({
      success: true,
      data: policies
    });
  } catch (error) {
    logger.error(`Error in getDefaultPolicies: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Create new policy
export const createPolicy = async (req, res, next) => {
  try {
    const policy = await Policy.create({
      ...req.body,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    res.status(201).json({
      success: true,
      data: policy
    });
  } catch (error) {
    logger.error(`Error in createPolicy: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update policy
export const updatePolicy = async (req, res, next) => {
  try {
    const policy = await Policy.findOneAndUpdate(
      { slug: req.params.slug },
      { 
        ...req.body,
        updatedBy: req.user.id 
      },
      { new: true, runValidators: true }
    );
    
    if (!policy) {
      return next(new AppError('Policy not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: policy
    });
  } catch (error) {
    logger.error(`Error in updatePolicy: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Delete policy
export const deletePolicy = async (req, res, next) => {
  try {
    const policy = await Policy.findOneAndDelete({ slug: req.params.slug });
    
    if (!policy) {
      return next(new AppError('Policy not found', 404));
    }
    
    res.status(200).json({
      success: true,
      message: 'Policy deleted successfully'
    });
  } catch (error) {
    logger.error(`Error in deletePolicy: ${error.message}`);
    next(new AppError(error.message, 500));
  }
}; 