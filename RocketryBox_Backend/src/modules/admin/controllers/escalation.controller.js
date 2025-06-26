import { 
  PickupEscalation, 
  ShipmentEscalation, 
  BillingEscalation, 
  WeightEscalation, 
  TechEscalation 
} from '../models/escalation.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import mongoose from 'mongoose';

// Helper functions
const getEscalationModel = (type) => {
  switch(type?.toLowerCase()) {
    case 'pickup': return PickupEscalation;
    case 'shipment': return ShipmentEscalation;
    case 'billing': return BillingEscalation;
    case 'weight': return WeightEscalation;
    case 'tech': return TechEscalation;
    default: return null;
  }
};

const getAllEscalationModels = () => [
  PickupEscalation,
  ShipmentEscalation,
  BillingEscalation,
  WeightEscalation,
  TechEscalation
];

// Get escalation statistics for dashboard
export const getEscalationStats = async (req, res, next) => {
  try {
    const models = getAllEscalationModels();
    
    // Execute stats aggregation for each model type
    const statsPromises = models.map(async (Model) => {
      const modelName = Model.modelName.replace('Escalation', '');
      return {
        type: modelName,
        stats: await Model.getEscalationStats()
      };
    });
    
    // Get total counts by status across all escalation types
    const allStats = await Promise.all(statsPromises);
    
    // Combine stats by status
    const totalByStatus = {};
    
    allStats.forEach(({ stats }) => {
      stats.forEach(({ status, count }) => {
        totalByStatus[status] = (totalByStatus[status] || 0) + count;
      });
    });
    
    // Get priority stats
    const priorityStatsPromises = models.map(Model => Model.getPriorityStats());
    const priorityStatsAll = await Promise.all(priorityStatsPromises);
    
    // Combine priority stats
    const priorityStats = {};
    priorityStatsAll.forEach(stats => {
      stats.forEach(({ priority, count }) => {
        priorityStats[priority] = (priorityStats[priority] || 0) + count;
      });
    });
    
    // Format as array
    const formattedPriorityStats = Object.entries(priorityStats).map(([priority, count]) => ({ 
      priority, 
      count 
    }));
    
    // Get category stats
    const categoryStatsPromises = models.map(Model => Model.getEscalationsByCategory());
    const categoryStatsAll = await Promise.all(categoryStatsPromises);
    
    // Combine category stats
    const categoryStats = {};
    categoryStatsAll.forEach(stats => {
      stats.forEach(({ category, count, resolved, resolutionRate }) => {
        if (!categoryStats[category]) {
          categoryStats[category] = { count: 0, resolved: 0 };
        }
        categoryStats[category].count += count;
        categoryStats[category].resolved += resolved;
      });
    });
    
    // Calculate combined resolution rates
    const formattedCategoryStats = Object.entries(categoryStats).map(([category, data]) => ({
      category,
      count: data.count,
      resolved: data.resolved,
      resolutionRate: (data.resolved / Math.max(data.count, 1)) * 100
    }));
    
    // Format as array
    const formattedStatusStats = Object.entries(totalByStatus).map(([status, count]) => ({ 
      status, 
      count 
    }));
    
    // Count total escalations
    const totalEscalations = formattedStatusStats.reduce((sum, { count }) => sum + count, 0);
    
    // Count open escalations (not Closed or Resolved)
    const openEscalations = formattedStatusStats
      .filter(({ status }) => !['Closed', 'Resolved'].includes(status))
      .reduce((sum, { status, count }) => sum + count, 0);
    
    // Get recent escalations
    const recentEscalationsPromises = models.map(Model => 
      Model.getRecentEscalations(5)
        .then(data => data.map(item => ({
          ...item,
          type: Model.modelName.replace('Escalation', '')
        })))
    );
    
    const recentEscalationsAll = await Promise.all(recentEscalationsPromises);
    const recentEscalations = recentEscalationsAll
      .flat()
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);
    
    // Return aggregated statistics
    res.status(200).json({
      success: true,
      data: {
        totalEscalations,
        openEscalations,
        byType: allStats,
        byStatus: formattedStatusStats,
        byPriority: formattedPriorityStats,
        byCategory: formattedCategoryStats,
        recentEscalations
      }
    });
  } catch (error) {
    logger.error(`Error in getEscalationStats: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};

// Search escalations with filters
export const searchEscalations = async (req, res, next) => {
  try {
    const {
      type,
      status,
      priority,
      category,
      searchText,
      sellerId,
      customerId,
      assignedTo,
      fromDate,
      toDate,
      isUrgent,
      page = 1,
      limit = 10
    } = req.query;
    
    // Determine which model(s) to query based on type
    let models = [];
    if (type) {
      const model = getEscalationModel(type);
      if (!model) {
        return next(new AppError(`Invalid escalation type: ${type}`, 400));
      }
      models = [model];
    } else {
      models = getAllEscalationModels();
    }
    
    // Build query object
    const query = {};
    
    // Add filters to query
    if (status) query.status = status;
    if (priority) query.priority = priority;
    if (category) query.category = category;
    if (sellerId) query['seller.id'] = mongoose.Types.ObjectId(sellerId);
    if (customerId) query['customer.id'] = mongoose.Types.ObjectId(customerId);
    if (assignedTo) query['assignedTo.id'] = mongoose.Types.ObjectId(assignedTo);
    if (isUrgent !== undefined) query.isUrgent = isUrgent === 'true';
    
    // Add date range if provided
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) {
        const toDateObj = new Date(toDate);
        toDateObj.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDateObj;
      }
    }
    
    // Add text search if provided
    if (searchText) {
      query.$or = [
        { description: { $regex: searchText, $options: 'i' } },
        { referenceId: { $regex: searchText, $options: 'i' } },
        { 'seller.name': { $regex: searchText, $options: 'i' } },
        { 'customer.name': { $regex: searchText, $options: 'i' } },
        { 'comments.comment': { $regex: searchText, $options: 'i' } }
      ];
    }
    
    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Query each model and combine results
    const resultsPromises = models.map(async (Model) => {
      const total = await Model.countDocuments(query);
      const modelName = Model.modelName.replace('Escalation', '');
      
      const results = await Model.find(query)
        .sort({ isUrgent: -1, createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit))
        .lean();
      
      return {
        type: modelName,
        total,
        results: results.map(result => ({
          ...result,
          escalationType: modelName
        }))
      };
    });
    
    const modelResults = await Promise.all(resultsPromises);
    
    // Calculate totals
    const totalResults = modelResults.reduce((sum, { total }) => sum + total, 0);
    
    // Combine and sort results from all models
    let combinedResults = [];
    modelResults.forEach(({ results }) => {
      combinedResults = [...combinedResults, ...results];
    });
    
    // Sort combined results by urgent flag and creation date
    combinedResults.sort((a, b) => {
      if (a.isUrgent !== b.isUrgent) return b.isUrgent ? 1 : -1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
    
    // Apply pagination to combined results
    const paginatedResults = combinedResults.slice(0, parseInt(limit));
    
    // Return search results
    res.status(200).json({
      success: true,
      data: {
        total: totalResults,
        page: parseInt(page),
        limit: parseInt(limit),
        results: paginatedResults,
        byType: modelResults.map(({ type, total }) => ({ type, count: total }))
      }
    });
  } catch (error) {
    logger.error(`Error in searchEscalations: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};

// Get a specific escalation by ID and type
export const getEscalationById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    
    if (!type) {
      return next(new AppError('Escalation type is required', 400));
    }
    
    const Model = getEscalationModel(type);
    if (!Model) {
      return next(new AppError(`Invalid escalation type: ${type}`, 400));
    }
    
    const escalation = await Model.findById(id).lean();
    if (!escalation) {
      return next(new AppError('Escalation not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: {
        ...escalation,
        escalationType: type
      }
    });
  } catch (error) {
    logger.error(`Error in getEscalationById: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};

// Create a new escalation
export const createEscalation = async (req, res, next) => {
  try {
    const { type } = req.query;
    
    if (!type) {
      return next(new AppError('Escalation type is required', 400));
    }
    
    const Model = getEscalationModel(type);
    if (!Model) {
      return next(new AppError(`Invalid escalation type: ${type}`, 400));
    }
    
    // Add admin who created the escalation
    const escalationData = {
      ...req.body,
      escalationType: type,
      statusHistory: [{
        status: req.body.status || 'Pending',
        updatedBy: {
          id: req.user.id,
          name: req.user.name,
          role: req.user.role
        },
        remarks: 'Escalation created'
      }]
    };
    
    const escalation = await Model.create(escalationData);
    
    res.status(201).json({
      success: true,
      data: escalation
    });
  } catch (error) {
    logger.error(`Error in createEscalation: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};

// Update an escalation
export const updateEscalation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const updateData = req.body;
    
    if (!type) {
      return next(new AppError('Escalation type is required', 400));
    }
    
    const Model = getEscalationModel(type);
    if (!Model) {
      return next(new AppError(`Invalid escalation type: ${type}`, 400));
    }
    
    const escalation = await Model.findById(id);
    if (!escalation) {
      return next(new AppError('Escalation not found', 404));
    }
    
    // If status is changing, add to status history
    if (updateData.status && updateData.status !== escalation.status) {
      const statusUpdate = {
        status: updateData.status,
        updatedBy: {
          id: req.user.id,
          name: req.user.name,
          role: req.user.role
        },
        timestamp: new Date(),
        remarks: updateData.statusRemarks || `Status changed from ${escalation.status} to ${updateData.status}`
      };
      
      // Add to status history
      updateData.statusHistory = [...escalation.statusHistory, statusUpdate];
      
      // If status is changing to Resolved, add resolution details
      if (updateData.status === 'Resolved' && updateData.resolution) {
        updateData.resolution = {
          ...updateData.resolution,
          resolvedBy: {
            id: req.user.id,
            name: req.user.name,
            role: req.user.role
          },
          resolvedAt: new Date()
        };
      }
    }
    
    // Remove statusRemarks from update data
    delete updateData.statusRemarks;
    
    // Update the escalation
    const updatedEscalation = await Model.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true }
    );
    
    res.status(200).json({
      success: true,
      data: updatedEscalation
    });
  } catch (error) {
    logger.error(`Error in updateEscalation: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};

// Add a comment to an escalation
export const addComment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const { comment } = req.body;
    
    if (!type) {
      return next(new AppError('Escalation type is required', 400));
    }
    
    if (!comment) {
      return next(new AppError('Comment is required', 400));
    }
    
    const Model = getEscalationModel(type);
    if (!Model) {
      return next(new AppError(`Invalid escalation type: ${type}`, 400));
    }
    
    const escalation = await Model.findById(id);
    if (!escalation) {
      return next(new AppError('Escalation not found', 404));
    }
    
    // Create comment object
    const commentObj = {
      comment,
      addedBy: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role
      },
      timestamp: new Date()
    };
    
    // Add comment to escalation
    escalation.comments.push(commentObj);
    await escalation.save();
    
    res.status(200).json({
      success: true,
      data: commentObj
    });
  } catch (error) {
    logger.error(`Error in addComment: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};

// Assign an escalation to an admin
export const assignEscalation = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query;
    const { adminId, adminName, adminRole } = req.body;
    
    if (!type) {
      return next(new AppError('Escalation type is required', 400));
    }
    
    if (!adminId || !adminName) {
      return next(new AppError('Admin ID and name are required', 400));
    }
    
    const Model = getEscalationModel(type);
    if (!Model) {
      return next(new AppError(`Invalid escalation type: ${type}`, 400));
    }
    
    const escalation = await Model.findById(id);
    if (!escalation) {
      return next(new AppError('Escalation not found', 404));
    }
    
    // Update assigned admin
    const assignedTo = {
      id: adminId,
      name: adminName,
      role: adminRole
    };
    
    // Add status history entry for assignment
    const statusUpdate = {
      status: escalation.status, // Keep current status
      updatedBy: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role
      },
      timestamp: new Date(),
      remarks: `Assigned to ${adminName}`
    };
    
    // Update escalation
    escalation.assignedTo = assignedTo;
    escalation.statusHistory.push(statusUpdate);
    await escalation.save();
    
    res.status(200).json({
      success: true,
      data: {
        assignedTo,
        message: `Escalation assigned to ${adminName}`
      }
    });
  } catch (error) {
    logger.error(`Error in assignEscalation: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};

// Bulk update escalation status
export const bulkUpdateStatus = async (req, res, next) => {
  try {
    const { ids, type, status, remarks } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return next(new AppError('Escalation IDs array is required', 400));
    }
    
    if (!type) {
      return next(new AppError('Escalation type is required', 400));
    }
    
    if (!status) {
      return next(new AppError('New status is required', 400));
    }
    
    const Model = getEscalationModel(type);
    if (!Model) {
      return next(new AppError(`Invalid escalation type: ${type}`, 400));
    }
    
    // Create status history entry
    const statusUpdate = {
      status,
      updatedBy: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role
      },
      timestamp: new Date(),
      remarks: remarks || `Status updated to ${status}`
    };
    
    // Update all escalations
    const result = await Model.updateMany(
      { _id: { $in: ids } },
      { 
        $set: { status },
        $push: { statusHistory: statusUpdate }
      }
    );
    
    res.status(200).json({
      success: true,
      data: {
        message: `Updated ${result.modifiedCount} escalations to status: ${status}`,
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error) {
    logger.error(`Error in bulkUpdateStatus: ${error.message}`);
    next(new AppError(error.message, 400));
  }
};