import ShippingPartner from '../models/shippingPartner.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import mongoose from 'mongoose';
import csv from 'fast-csv';
import xlsx from 'xlsx';
import fs from 'fs';
import path from 'path';
import { io } from '../../../server.js';
import { getCache, setCache, deleteCache } from '../../../utils/redis.js';
import { sendEmail } from '../../../utils/email.js';
import { logger } from '../../../utils/logger.js';

/**
 * Get all shipping partners with filters and pagination
 * @route GET /api/v2/admin/partners
 * @access Private (Admin only)
 */
export const getShippingPartners = async (req, res, next) => {
  try {
    const {
      name,
      status,
      performanceMin,
      performanceMax,
      sort = '-createdAt',
      limit = 10,
      page = 1
    } = req.query;

    // Build filter object
    const filter = {};
    if (name) filter.name = { $regex: name, $options: 'i' };
    if (status) filter.apiStatus = status;
    if (performanceMin || performanceMax) {
      filter.performanceScore = {};
      if (performanceMin) filter.performanceScore.$gte = Number(performanceMin);
      if (performanceMax) filter.performanceScore.$lte = Number(performanceMax);
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Check for cached data
    const cacheKey = `shipping_partners:${JSON.stringify(filter)}:${sort}:${limitNum}:${pageNum}`;
    const cachedData = await getCache(cacheKey);
    if (cachedData) {
      return res.status(200).json(cachedData);
    }

    // Execute query with pagination
    const [partners, total] = await Promise.all([
      ShippingPartner.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ShippingPartner.countDocuments(filter)
    ]);

    // Transform partners data to match frontend expectations
    const transformedPartners = partners.map(partner => ({
      ...partner,
      id: partner._id.toString(),
      performanceScore: partner.performanceScore ? partner.performanceScore.toString() + '%' : '0%',
      deliverySuccess: partner.deliverySuccess ? partner.deliverySuccess.toString() + '%' : '0%',
      lastUpdated: partner.lastUpdated ? new Date(partner.lastUpdated).toLocaleDateString() : new Date().toLocaleDateString(),
      integrationDate: partner.integrationDate ? new Date(partner.integrationDate).toLocaleDateString() : new Date().toLocaleDateString()
    }));

    // Prepare response data
    const response = {
      success: true,
      count: transformedPartners.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: transformedPartners
    };

    // Cache the response
    await setCache(cacheKey, response, 300); // Cache for 5 minutes

    res.status(200).json(response);
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get shipping partner by ID
 * @route GET /api/v2/admin/partners/:id
 * @access Private (Admin only)
 */
export const getShippingPartnerById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid partner ID', 400));
    }

    const partner = await ShippingPartner.findById(id);

    if (!partner) {
      return next(new AppError('Shipping partner not found', 404));
    }

    // Transform partner data to match frontend expectations
    const transformedPartner = {
      ...partner.toObject(),
      id: partner._id.toString(),
      performanceScore: partner.performanceScore ? partner.performanceScore.toString() + '%' : '0%',
      deliverySuccess: partner.deliverySuccess ? partner.deliverySuccess.toString() + '%' : '0%',
      lastUpdated: partner.lastUpdated ? new Date(partner.lastUpdated).toLocaleDateString() : new Date().toLocaleDateString(),
      integrationDate: partner.integrationDate ? new Date(partner.integrationDate).toLocaleDateString() : new Date().toLocaleDateString()
    };

    res.status(200).json({
      success: true,
      data: transformedPartner
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Create a new shipping partner
 * @route POST /api/v2/admin/partners
 * @access Private (Admin only)
 */
export const createShippingPartner = async (req, res) => {
    try {
        const { name, logoUrl, apiStatus, supportContact, supportEmail, serviceTypes, serviceAreas, weightLimits, dimensionLimits, rates } = req.body;

        // Check for duplicate partner name
        const existingPartner = await ShippingPartner.findOne({ 
            name: { $regex: new RegExp(`^${name}$`, 'i') } 
        });
        
        if (existingPartner) {
            return res.status(400).json({
                success: false,
                message: "A partner with this name already exists",
                error: "DUPLICATE_PARTNER"
            });
        }

        // Validate weight limits
        if (weightLimits.min >= weightLimits.max) {
            return res.status(400).json({
                success: false,
                message: "Minimum weight must be less than maximum weight",
                error: "INVALID_WEIGHT_LIMITS"
            });
        }

        // Validate rates
        if (rates.baseRate < 0 || rates.weightRate < 0) {
            return res.status(400).json({
                success: false,
                message: "Rates cannot be negative",
                error: "INVALID_RATES"
            });
        }

        // Validate service types and areas
        if (!serviceTypes?.length || !serviceAreas?.length) {
            return res.status(400).json({
                success: false,
                message: "At least one service type and area is required",
                error: "INVALID_SERVICES"
            });
        }

        const partner = new ShippingPartner({
            name,
            logoUrl,
            apiStatus,
            supportContact,
            supportEmail,
            serviceTypes,
            serviceAreas,
            weightLimits,
            dimensionLimits,
            rates,
            integrationDate: new Date(),
            status: "active",
            statusHistory: [{
                status: "active",
                changedAt: new Date(),
                changedBy: req.user.id,
                reason: "Initial creation"
            }]
        });

        await partner.save();

        // Invalidate cache
        await deleteCache('shipping_partners:all');

        // Emit real-time update
        io.emit('partner:created', {
            partner: {
                id: partner._id,
                name: partner.name,
                status: partner.status
            }
        });

        res.status(201).json({
            success: true,
            message: "Shipping partner created successfully",
            data: partner
        });
    } catch (error) {
        console.error("Error creating shipping partner:", error);
        
        // Handle validation errors
        if (error.name === 'ValidationError') {
            return res.status(400).json({
                success: false,
                message: "Validation error",
                error: "VALIDATION_ERROR",
                details: Object.values(error.errors).map(err => err.message)
            });
        }

        // Handle duplicate key errors
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: "A partner with this name or email already exists",
                error: "DUPLICATE_ENTRY"
            });
        }

        res.status(500).json({
            success: false,
            message: "Failed to create shipping partner",
            error: error.message
        });
    }
};

/**
 * Update shipping partner
 * @route PUT /api/v2/admin/partners/:id
 * @access Private (Admin only)
 */
export const updateShippingPartner = async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid partner ID', 400));
    }

    // Find existing partner
    const partner = await ShippingPartner.findById(id);
    if (!partner) {
      return next(new AppError('Shipping partner not found', 404));
    }

    // Check if status is being updated
    if (updateData.apiStatus && updateData.apiStatus !== partner.apiStatus) {
      // Add to status history
      const statusUpdate = {
        status: updateData.apiStatus,
        reason: updateData.statusReason || 'Status update',
        updatedBy: req.user.id,
        timestamp: new Date()
      };

      partner.statusHistory.push(statusUpdate);
    }

    // Update the lastUpdated field
    updateData.lastUpdated = new Date();

    // Update the partner
    const updatedPartner = await ShippingPartner.findByIdAndUpdate(
      id, 
      updateData, 
      { new: true, runValidators: true }
    );

    // Invalidate cache
    deleteCache('shipping_partners:all');
    deleteCache(`shipping_partners:${id}`);

    // Emit event for real-time updates
    io.emit('partner:updated', {
      id: updatedPartner._id,
      name: updatedPartner.name,
      apiStatus: updatedPartner.apiStatus
    });

    res.status(200).json({
      success: true,
      message: 'Shipping partner updated successfully',
      data: updatedPartner
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Update shipping partner status
 * @route PATCH /api/v2/admin/partners/:id/status
 * @access Private (Admin only)
 */
export const updatePartnerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid partner ID', 400));
    }

    // Validate status
    if (!['active', 'inactive', 'maintenance'].includes(status)) {
      return next(new AppError('Invalid status. Must be active, inactive, or maintenance', 400));
    }

    // Find the partner
    const partner = await ShippingPartner.findById(id);
    if (!partner) {
      return next(new AppError('Shipping partner not found', 404));
    }

    // Update status and add to history
    partner.apiStatus = status;
    partner.lastUpdated = new Date();
    partner.statusHistory.push({
      status,
      reason: reason || 'Status update',
      updatedBy: req.user.id,
      timestamp: new Date()
    });

    await partner.save();

    // Invalidate cache
    deleteCache('shipping_partners:all');
    deleteCache(`shipping_partners:${id}`);

    // Emit event for real-time updates
    io.emit('partner:status_updated', {
      id: partner._id,
      name: partner.name,
      status: partner.apiStatus
    });

    // If status changed to inactive or maintenance, notify support team
    if (status === 'inactive' || status === 'maintenance') {
      await sendEmail({
        to: process.env.SUPPORT_EMAIL || process.env.ADMIN_EMAIL,
        subject: `Shipping Partner Status Change: ${partner.name}`,
        text: `The shipping partner ${partner.name} has been set to ${status} status.\n\nReason: ${reason || 'Status update'}\n\nUpdated by: ${req.user.email}`
      });
    }

    res.status(200).json({
      success: true,
      data: {
        id: partner._id,
        status: partner.apiStatus,
        message: `Partner status updated to ${status}`
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Delete shipping partner
 * @route DELETE /api/v2/admin/partners/:id
 * @access Private (Admin only - SuperAdmin)
 */
export const deleteShippingPartner = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid partner ID', 400));
    }

    // Check if user is superAdmin
    if (!req.user.isSuperAdmin) {
      return next(new AppError('Only super administrators can delete shipping partners', 403));
    }

    // Find and delete the partner
    const partner = await ShippingPartner.findByIdAndDelete(id);
    
    if (!partner) {
      return next(new AppError('Shipping partner not found', 404));
    }

    // Invalidate cache
    deleteCache('shipping_partners:all');

    // Emit event for real-time updates
    io.emit('partner:deleted', {
      id,
      name: partner.name
    });

    res.status(200).json({
      success: true,
      message: 'Shipping partner deleted successfully'
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get shipping partner performance metrics
 * @route GET /api/v2/admin/partners/:id/performance
 * @access Private (Admin only)
 */
export const getPartnerPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { period = 'last30days' } = req.query;

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid partner ID', 400));
    }

    // Find the partner
    const partner = await ShippingPartner.findById(id);
    if (!partner) {
      return next(new AppError('Shipping partner not found', 404));
    }

    // Get performance history based on period
    let startDate = new Date();
    switch (period) {
      case 'last7days':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'last30days':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case 'last90days':
        startDate.setDate(startDate.getDate() - 90);
        break;
      case 'last6months':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case 'last12months':
        startDate.setMonth(startDate.getMonth() - 12);
        break;
      default:
        startDate.setDate(startDate.getDate() - 30);
    }

    // Filter performance history
    const performanceData = partner.performanceHistory.filter(
      entry => new Date(entry.date) >= startDate
    );

    // Calculate average metrics
    const metrics = performanceData.reduce((acc, curr) => {
      acc.deliverySuccess += curr.deliverySuccess || 0;
      acc.onTimeDelivery += curr.onTimeDelivery || 0;
      acc.pickupSuccess += curr.pickupSuccess || 0;
      acc.exceptionRate += curr.exceptionRate || 0;
      acc.averageDeliveryTime += curr.averageDeliveryTime || 0;
      acc.complaintResolutionTime += curr.complaintResolutionTime || 0;
      acc.count += 1;
      return acc;
    }, {
      deliverySuccess: 0,
      onTimeDelivery: 0,
      pickupSuccess: 0,
      exceptionRate: 0,
      averageDeliveryTime: 0,
      complaintResolutionTime: 0,
      count: 0
    });

    const count = metrics.count || 1; // Avoid division by zero
    
    // Format the response data
    const responseData = {
      deliverySuccess: (metrics.deliverySuccess / count).toFixed(2) + '%',
      onTimeDelivery: (metrics.onTimeDelivery / count).toFixed(2) + '%',
      pickupSuccess: (metrics.pickupSuccess / count).toFixed(2) + '%',
      exceptionRate: (metrics.exceptionRate / count).toFixed(2) + '%',
      averageDeliveryTime: (metrics.averageDeliveryTime / count).toFixed(1) + ' hours',
      complaintResolutionTime: (metrics.complaintResolutionTime / count).toFixed(1) + ' hours',
      shipmentVolume: partner.shipmentCount,
      performanceHistory: performanceData
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Update shipping partner performance metrics
 * @route POST /api/v2/admin/partners/:id/performance
 * @access Private (Admin only)
 */
export const updatePartnerPerformance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const performanceData = req.body;

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid partner ID', 400));
    }

    // Find the partner
    const partner = await ShippingPartner.findById(id);
    if (!partner) {
      return next(new AppError('Shipping partner not found', 404));
    }

    // Add new performance record
    const newPerformance = {
      date: new Date(),
      deliverySuccess: performanceData.deliverySuccess,
      onTimeDelivery: performanceData.onTimeDelivery,
      pickupSuccess: performanceData.pickupSuccess,
      exceptionRate: performanceData.exceptionRate,
      averageDeliveryTime: performanceData.averageDeliveryTime,
      complaintResolutionTime: performanceData.complaintResolutionTime
    };

    partner.performanceHistory.push(newPerformance);

    // Update overall performance score
    // Simple weighted calculation based on delivery success and on-time delivery
    const deliverySuccessWeight = 0.4;
    const onTimeDeliveryWeight = 0.3;
    const pickupSuccessWeight = 0.2;
    const exceptionRateWeight = 0.1;

    partner.performanceScore = (
      (performanceData.deliverySuccess * deliverySuccessWeight) +
      (performanceData.onTimeDelivery * onTimeDeliveryWeight) +
      (performanceData.pickupSuccess * pickupSuccessWeight) +
      (100 - performanceData.exceptionRate) * exceptionRateWeight
    );

    // Update lastUpdated field
    partner.lastUpdated = new Date();
    
    // Save the partner
    await partner.save();

    // Invalidate cache
    deleteCache('shipping_partners:all');
    deleteCache(`shipping_partners:${id}`);

    res.status(200).json({
      success: true,
      message: 'Performance metrics updated successfully',
      data: {
        id: partner._id,
        performanceScore: partner.performanceScore.toFixed(2),
        lastUpdated: partner.lastUpdated
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Export shipping partners data
 * @route GET /api/v2/admin/partners/export
 * @access Private (Admin only)
 */
export const exportPartners = async (req, res, next) => {
  try {
    const { format = 'csv' } = req.query;

    // Fetch all partners
    const partners = await ShippingPartner.find({}).lean();

    // Prepare data for export
    const exportData = partners.map(partner => ({
      ID: partner._id.toString(),
      Name: partner.name,
      Status: partner.apiStatus,
      'Performance Score': partner.performanceScore.toFixed(2),
      'Delivery Success': partner.deliverySuccess + '%',
      'Shipment Count': partner.shipmentCount,
      'Support Contact': partner.supportContact,
      'Support Email': partner.supportEmail,
      'Integration Date': new Date(partner.integrationDate).toLocaleDateString(),
      'Last Updated': new Date(partner.lastUpdated).toLocaleDateString()
    }));

    if (format === 'xlsx') {
      // Create XLSX file
      const worksheet = xlsx.utils.json_to_sheet(exportData);
      const workbook = xlsx.utils.book_new();
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Partners');
      
      // Create temp directory if it doesn't exist
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir);
      }
      
      const filePath = path.join(tempDir, 'shipping_partners.xlsx');
      xlsx.writeFile(workbook, filePath);
      
      res.download(filePath, 'shipping_partners.xlsx', (err) => {
        if (err) {
          next(new AppError('Error downloading file', 500));
        }
        
        // Remove temp file
        fs.unlinkSync(filePath);
      });
    } else {
      // Default to CSV
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="shipping_partners.csv"');
      
      const csvStream = csv.format({ headers: true });
      csvStream.pipe(res);
      
      exportData.forEach(partner => {
        csvStream.write(partner);
      });
      
      csvStream.end();
    }
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get shipping partner rate cards
 * @route GET /api/v2/admin/partners/:id/rates
 * @access Private (Admin only)
 */
export const getPartnerRates = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid partner ID', 400));
    }

    // Find the partner
    const partner = await ShippingPartner.findById(id, 'name rates zones weightLimits');
    
    if (!partner) {
      return next(new AppError('Shipping partner not found', 404));
    }

    res.status(200).json({
      success: true,
      data: {
        name: partner.name,
        rates: partner.rates,
        zones: partner.zones,
        weightLimits: partner.weightLimits,
        lastUpdated: partner.lastUpdated
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Update shipping partner rate cards
 * @route PUT /api/v2/admin/partners/:id/rates
 * @access Private (Admin only)
 */
export const updatePartnerRates = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { rates, zones } = req.body;

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid partner ID', 400));
    }

    // Find the partner
    const partner = await ShippingPartner.findById(id);
    
    if (!partner) {
      return next(new AppError('Shipping partner not found', 404));
    }

    // Update rates if provided
    if (rates) {
      partner.rates = rates;
    }

    // Update zones if provided
    if (zones) {
      partner.zones = zones;
    }

    // Update lastUpdated timestamp
    partner.lastUpdated = new Date();

    await partner.save();

    // Invalidate cache
    deleteCache('shipping_partners:all');
    deleteCache(`shipping_partners:${id}`);

    res.status(200).json({
      success: true,
      message: 'Rate card updated successfully',
      data: {
        name: partner.name,
        rates: partner.rates,
        zones: partner.zones,
        lastUpdated: partner.lastUpdated
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
}; 