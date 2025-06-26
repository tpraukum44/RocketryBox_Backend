import AdminNDR from '../models/ndr.model.js';
import SellerNDR from '../../seller/models/ndr.model.js';
import ShippingPartner from '../models/shippingPartner.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import mongoose from 'mongoose';
import { logger } from '../../../utils/logger.js';
import { sendEmail } from '../../../utils/email.js';
import { sendSMS } from '../../../utils/sms.js';
import { io } from '../../../server.js';

/**
 * Get all NDRs with filtering, sorting, and pagination
 */
export const getNDRs = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 20,
      sortField = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sort = {};
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [ndrs, total] = await Promise.all([
      AdminNDR.find()
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AdminNDR.countDocuments()
    ]);

    res.status(200).json({
      success: true,
      count: ndrs.length,
      total,
      data: ndrs
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get NDR by ID
 */
export const getNDRById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ndr = await AdminNDR.findById(id);
    
    if (!ndr) {
      return next(new AppError('NDR not found', 404));
    }

    res.status(200).json({
      success: true,
      data: ndr
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Sync NDRs from seller NDRs
 */
export const syncNDRs = async (req, res, next) => {
  try {
    const sellerNDRs = await SellerNDR.find()
      .limit(20)
      .populate('orderId')
      .populate('shipmentId');
    
    let syncedCount = 0;
    
    for (const sellerNDR of sellerNDRs) {
      try {
        const existingNDR = await AdminNDR.findOne({
          originalNDR: sellerNDR._id
        });
        
        if (!existingNDR) {
          // Create new admin NDR
          const adminNDR = new AdminNDR({
            originalNDR: sellerNDR._id,
            orderId: sellerNDR.orderId._id,
            orderModel: 'SellerOrder',
            shipmentId: sellerNDR.shipmentId._id,
            shipmentModel: 'SellerShipment',
            awb: sellerNDR.awb,
            customer: sellerNDR.customer,
            seller: sellerNDR.seller,
            courier: sellerNDR.courier,
            status: sellerNDR.status,
            reason: sellerNDR.reason,
            reasonCategory: 'Customer Not Available',
            products: sellerNDR.products
          });
          
          await adminNDR.save();
          syncedCount++;
        }
      } catch (error) {
        console.error(`Error syncing NDR: ${error.message}`);
      }
    }
    
    res.status(200).json({
      success: true,
      syncedCount
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Update NDR status
 */
export const updateNDRStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const ndr = await AdminNDR.findById(id);
    
    if (!ndr) {
      return next(new AppError('NDR not found', 404));
    }

    ndr.status = status;
    await ndr.save();

    res.status(200).json({
      success: true,
      data: {
        id: ndr._id,
        status: ndr.status
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Assign NDR to admin
 */
export const assignNDR = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedTo, comments } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid NDR ID format', 400));
    }

    // Find the NDR
    const ndr = await AdminNDR.findById(id);

    if (!ndr) {
      return next(new AppError('NDR not found', 404));
    }

    // Find the admin
    const admin = await mongoose.model('Admin').findById(assignedTo);
    
    if (!admin) {
      return next(new AppError('Admin not found', 404));
    }

    // Update assignment
    ndr.assignedTo = {
      id: admin._id,
      name: admin.name,
      role: admin.role
    };

    // Add comment if provided
    if (comments) {
      ndr.comments.push({
        comment: comments,
        addedBy: {
          id: req.user.id,
          name: req.user.name,
          role: req.user.role
        }
      });
    }

    // Save changes
    await ndr.save();

    res.status(200).json({
      success: true,
      data: {
        id: ndr._id,
        assignedTo: ndr.assignedTo,
        message: `NDR assigned to ${admin.name} successfully`
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Initiate RTO
 */
export const initiateRTO = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, remarks } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid NDR ID format', 400));
    }

    // Find the NDR
    const ndr = await AdminNDR.findById(id);

    if (!ndr) {
      return next(new AppError('NDR not found', 404));
    }

    // Update NDR with RTO details
    ndr.status = 'RTO Initiated';
    ndr.actionTaken = 'RTO Initiated';
    
    ndr.rtoDetails = {
      initiatedDate: new Date(),
      reason,
      status: 'Initiated'
    };

    ndr.statusHistory.push({
      status: 'RTO Initiated',
      updatedBy: {
        id: req.user.id,
        name: req.user.name,
        role: req.user.role
      },
      reason,
      timestamp: new Date()
    });

    // Save changes
    await ndr.save();

    res.status(200).json({
      success: true,
      data: {
        id: ndr._id,
        status: ndr.status,
        message: 'RTO initiated successfully'
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get NDR statistics
 */
export const getNDRStats = async (req, res, next) => {
  try {
    // Get NDR stats by courier
    const courierStats = await AdminNDR.getNDRStatsByCourier();

    // Get NDR stats by reason category
    const reasonStats = await AdminNDR.getNDRStatsByReasonCategory();

    // Get NDR counts by status
    const statusCounts = await AdminNDR.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          status: '$_id',
          count: 1,
          _id: 0
        }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        courierStats,
        reasonStats,
        statusCounts
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Helper function to determine reason category based on NDR reason
function determineReasonCategory(reason) {
  if (!reason) return 'Customer Not Available';
  
  reason = reason.toLowerCase();
  
  if (reason.includes('address') || reason.includes('location')) {
    return 'Address Issues';
  } else if (reason.includes('damage') || reason.includes('restrict')) {
    return 'Delivery Issues';
  } else if (reason.includes('refuse') || reason.includes('reject') || reason.includes('cancel')) {
    return 'Customer Refusal';
  }
  
  return 'Customer Not Available';
} 