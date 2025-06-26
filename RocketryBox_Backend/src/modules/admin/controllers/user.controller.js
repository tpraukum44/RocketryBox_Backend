import mongoose from 'mongoose';
import { AppError } from '../../../middleware/errorHandler.js';
import RateCard from '../../../models/ratecard.model.js';
import SellerRateCard from '../../../models/sellerRateCard.model.js';
import { invalidateCachePattern } from '../../../utils/cache.js';
import { logger } from '../../../utils/logger.js';
import { getIO } from '../../../utils/socketio.js';
import { getUserTypeFromRBId, isValidRBUserId } from '../../../utils/userIdGenerator.js';
import Customer from '../../customer/models/customer.model.js';
import { getCustomerProfile } from '../../customer/services/realtime.service.js';
import Agreement from '../../seller/models/agreement.model.js';
import Seller from '../../seller/models/seller.model.js';
import { getSellerProfile } from '../../seller/services/realtime.service.js';

/**
 * Get all users (both sellers and customers) with pagination and filters
 * @route GET /api/v2/admin/users
 * @access Private (Admin only)
 */
export const getAllUsers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status,
      search,
      type = 'seller' // Default to seller for backward compatibility
    } = req.query;

    if (type === 'seller') {
      return getAllSellers(req, res, next);
    } else if (type === 'customer') {
      return getAllCustomers(req, res, next);
    } else {
      // Return combined results if no specific type requested
      const sellerQuery = { type: 'seller', ...req.query };
      const customerQuery = { type: 'customer', ...req.query };

      // For simplicity, default to sellers if no type specified
      return getAllSellers(req, res, next);
    }
  } catch (error) {
    logger.error(`Error in getAllUsers: ${error.message}`);
    next(new AppError('Failed to fetch users', 500));
  }
};

/**
 * Get user details by ID (auto-detect if seller or customer)
 * @route GET /api/v2/admin/users/:id
 * @access Private (Admin only)
 */
export const getUserDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    logger.info(`getUserDetails called with ID: "${id}"`);
    logger.info(`ID type: ${typeof id}, length: ${id ? id.length : 'null'}`);

    // Basic validation
    if (!id || id === 'undefined' || id === 'null' || id.trim() === '') {
      logger.warn(`Empty or invalid user ID received: "${id}"`);
      return next(new AppError('User ID is required', 400));
    }

    // Clean and decode the ID (handle URL encoding)
    let cleanId;
    try {
      cleanId = decodeURIComponent(id.trim());
    } catch (decodeError) {
      cleanId = id.trim();
    }

    logger.info(`Cleaned ID: "${cleanId}"`);

    // Check if it's a valid RB user ID format
    if (isValidRBUserId(cleanId)) {
      logger.info(`Valid RB User ID format detected: ${cleanId}`);

      const userType = getUserTypeFromRBId(cleanId);
      logger.info(`User type from RB ID: ${userType}`);

      if (userType === 'seller') {
        // Search for seller by RB user ID
        try {
          const seller = await Seller.findOne({ rbUserId: cleanId });
          if (seller) {
            logger.info(`Found seller with RB ID ${cleanId}: ${seller.name} (${seller.email})`);
            logger.info(`Converting to MongoDB ID: ${seller._id.toString()}`);
            req.params.id = seller._id.toString();
            return getSellerDetails(req, res, next);
          } else {
            logger.warn(`No seller found with RB ID: ${cleanId}`);
          }
        } catch (sellerSearchError) {
          logger.error(`Error searching for seller with RB ID ${cleanId}: ${sellerSearchError.message}`);
          return next(new AppError('Error searching for seller', 500));
        }
      } else if (userType === 'customer') {
        // Search for customer by RB user ID
        try {
          const customer = await Customer.findOne({ rbUserId: cleanId }, null, { skipDefaultFilter: true });
          if (customer) {
            logger.info(`Found customer with RB ID ${cleanId}: ${customer.name} (${customer.email})`);
            logger.info(`Converting to MongoDB ID: ${customer._id.toString()}`);
            req.params.id = customer._id.toString();
            return getCustomerDetails(req, res, next);
          } else {
            logger.warn(`No customer found with RB ID: ${cleanId}`);
          }
        } catch (customerSearchError) {
          logger.error(`Error searching for customer with RB ID ${cleanId}: ${customerSearchError.message}`);
          return next(new AppError('Error searching for customer', 500));
        }
      }

      logger.warn(`No user found with RB ID: ${cleanId}`);
      return next(new AppError(`User not found with RB ID: ${cleanId}`, 404));
    }

    // Check if it's a valid ObjectId format (24 character hex string)
    const isValidObjectId = mongoose.Types.ObjectId.isValid(cleanId) && cleanId.length === 24 && /^[0-9a-fA-F]{24}$/.test(cleanId);

    if (!isValidObjectId) {
      logger.warn(`Invalid ID format (not RB ID or ObjectId): "${cleanId}"`);

      // Try to find by email or other identifier instead of throwing error immediately
      logger.info('Attempting to find user by email or other identifier...');

      try {
        // Try to find seller by email or business name (more flexible search)
        const sellerByEmail = await Seller.findOne({
          $or: [
            { email: { $regex: `^${cleanId}$`, $options: 'i' } },
            { businessName: { $regex: cleanId, $options: 'i' } },
            { name: { $regex: cleanId, $options: 'i' } }
          ]
        });

        if (sellerByEmail) {
          logger.info(`Found seller by email/name: ${sellerByEmail._id}`);
          req.params.id = sellerByEmail._id.toString();
          return getSellerDetails(req, res, next);
        }

        // Try to find customer by email or name (more flexible search)
        const customerByEmail = await Customer.findOne({
          $or: [
            { email: { $regex: `^${cleanId}$`, $options: 'i' } },
            { name: { $regex: cleanId, $options: 'i' } }
          ]
        }, null, { skipDefaultFilter: true });

        if (customerByEmail) {
          logger.info(`Found customer by email/name: ${customerByEmail._id}`);
          req.params.id = customerByEmail._id.toString();
          return getCustomerDetails(req, res, next);
        }

        // If no user found by email/name, return a more helpful error
        logger.warn(`No user found with identifier: ${cleanId}`);
        return next(new AppError(`User not found with identifier: ${cleanId}. Please check the user ID or email.`, 404));

      } catch (searchError) {
        logger.error(`Error searching by email/name: ${searchError.message}`);
        return next(new AppError('Error searching for user. Please check the user identifier.', 500));
      }
    }

    // If we have a valid ObjectId, proceed with normal lookup
    logger.info(`Valid ObjectId format detected: ${cleanId}`);

    // Try to find as seller first
    let seller;
    try {
      seller = await Seller.findById(cleanId);
      logger.info(`Seller search result: ${seller ? 'found' : 'not found'}`);
    } catch (sellerError) {
      logger.warn(`Error finding seller ${cleanId}: ${sellerError.message}`);
    }

    if (seller) {
      req.params.id = cleanId;
      return getSellerDetails(req, res, next);
    }

    // Try to find as customer with proper error handling
    let customer;
    try {
      customer = await Customer.findById(cleanId, null, { skipDefaultFilter: true });
      logger.info(`Customer search result: ${customer ? 'found' : 'not found'}`);
    } catch (customerError) {
      logger.warn(`Error finding customer ${cleanId}: ${customerError.message}`);
    }

    if (customer) {
      req.params.id = cleanId;
      return getCustomerDetails(req, res, next);
    }

    // If no user found by ID, provide helpful error message
    logger.warn(`No user found with ID: ${cleanId}`);
    return next(new AppError(`User not found with ID: ${cleanId}`, 404));

  } catch (error) {
    logger.error(`Error in getUserDetails: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    next(new AppError('Failed to fetch user details. Please try again.', 500));
  }
};

/**
 * Update user status (auto-detect if seller or customer)
 * @route PATCH /api/v2/admin/users/:id/status
 * @access Private (Admin only)
 */
export const updateUserStatus = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Try to find as seller first
    const seller = await Seller.findById(id);
    if (seller) {
      return updateSellerStatus(req, res, next);
    }

    // Try to find as customer
    const customer = await Customer.findById(id);
    if (customer) {
      return updateCustomerStatus(req, res, next);
    }

    return next(new AppError('User not found', 404));
  } catch (error) {
    logger.error(`Error in updateUserStatus: ${error.message}`);
    next(new AppError('Failed to update user status', 500));
  }
};

/**
 * Update user permissions (placeholder for future implementation)
 * @route PATCH /api/v2/admin/users/:id/permissions
 * @access Private (Admin only)
 */
export const updateUserPermissions = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    // For now, return success response since permissions are not implemented
    // This can be expanded later when user permissions are fully implemented

    res.status(200).json({
      success: true,
      message: 'User permissions updated successfully',
      data: {
        userId: id,
        permissions
      }
    });
  } catch (error) {
    logger.error(`Error in updateUserPermissions: ${error.message}`);
    next(new AppError('Failed to update user permissions', 500));
  }
};

/**
 * Get all sellers with pagination and filters
 * @route GET /api/v2/admin/users/sellers
 * @access Private (Admin only)
 */
export const getAllSellers = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortField = 'createdAt', // Support both sortBy and sortField
      sortOrder = 'desc',
      status,
      search,
      kycStatus
    } = req.query;

    // Use sortField if provided, otherwise fallback to sortBy
    let actualSortField = sortField || sortBy;

    // Map frontend field names to database field names
    const fieldMapping = {
      'userId': '_id',
      'name': 'name',
      'email': 'email',
      'status': 'status',
      'createdAt': 'createdAt',
      'lastActive': 'lastActive'
    };

    // Apply field mapping
    actualSortField = fieldMapping[actualSortField] || actualSortField;

    // Build query
    const query = {};

    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }

    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { 'businessDetails.name': { $regex: search, $options: 'i' } },
        { 'businessDetails.gstin': { $regex: search, $options: 'i' } }
      ];
    }

    // Add KYC status filter if provided (requires aggregation)
    let sellers;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    if (kycStatus) {
      // Use aggregation for KYC filtering
      sellers = await Seller.aggregate([
        {
          $lookup: {
            from: 'kycs',
            localField: '_id',
            foreignField: 'seller',
            as: 'kycDetails'
          }
        },
        {
          $match: {
            ...query,
            'kycDetails.status': kycStatus
          }
        },
        {
          $sort: { [actualSortField]: sortDirection }
        },
        {
          $skip: skip
        },
        {
          $limit: parseInt(limit)
        }
      ]);
    } else {
      // Use normal find for non-KYC filtering
      sellers = await Seller.find(query)
        .sort({ [actualSortField]: sortDirection })
        .skip(skip)
        .limit(parseInt(limit));
    }

    // Get total count for pagination
    const totalSellers = await Seller.countDocuments(query);

    // Transform sellers to match frontend expectations
    const transformedSellers = sellers.map(seller => ({
      id: seller._id ? seller._id.toString() : '',
      userId: seller.rbUserId || seller._id.toString(), // Use RB ID if available, fallback to ObjectId
      name: seller.name || '',
      email: seller.email || '',
      phone: seller.phone || '',
      status: seller.status ? seller.status.charAt(0).toUpperCase() + seller.status.slice(1) : 'Active',
      createdAt: seller.createdAt,
      lastActive: seller.lastActive,
      businessName: seller.businessName || '', // Company name
      companyCategory: seller.companyCategory || '',
      paymentType: seller.paymentType || 'wallet',
      rateBand: seller.rateBand || 'Standard',
      creditLimit: seller.creditLimit,
      creditPeriod: seller.creditPeriod,
      kycVerified: seller.kycVerified || false,
      documents: seller.documents || {}, // Include document statuses
      totalTransactions: 0 // Default value, can be enhanced later
    }));

    res.status(200).json({
      success: true,
      data: {
        sellers: transformedSellers,
        users: transformedSellers, // Alias for frontend compatibility
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalSellers / parseInt(limit)),
          totalResults: totalSellers
        }
      }
    });
  } catch (error) {
    logger.error(`Error in getAllSellers: ${error.message}`);
    next(new AppError('Failed to fetch sellers', 500));
  }
};

/**
 * Get seller details by ID including KYC, agreements and profile info
 * @route GET /api/v1/admin/users/sellers/:id
 * @access Private (Admin only)
 */
export const getSellerDetails = async (req, res, next) => {
  try {
    const { id: sellerId } = req.params;

    // Validate and convert to ObjectId safely
    if (!mongoose.Types.ObjectId.isValid(sellerId)) {
      logger.warn(`Invalid ObjectId for seller details: ${sellerId}`);
      return next(new AppError('Invalid seller ID format', 400));
    }

    logger.info(`Getting seller details for ID: ${sellerId}`);

    // Use MongoDB to find the seller with comprehensive details
    const sellerDetails = await Seller.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(sellerId)
        }
      },
      {
        $lookup: {
          from: 'ratecards',
          localField: 'rateCard',
          foreignField: '_id',
          as: 'rateCardDetails'
        }
      },
      {
        $lookup: {
          from: 'sellerorders',
          localField: '_id',
          foreignField: 'seller',
          as: 'orders',
          pipeline: [
            {
              $sort: {
                createdAt: -1
              }
            },
            {
              $limit: 10
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'sellershipments',
          localField: '_id',
          foreignField: 'seller',
          as: 'shipments',
          pipeline: [
            {
              $sort: {
                createdAt: -1
              }
            },
            {
              $limit: 10
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'sellerorders',
          localField: '_id',
          foreignField: 'seller',
          as: 'orderStats',
          pipeline: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ]
        }
      },
      {
        $lookup: {
          from: 'sellershipments',
          localField: '_id',
          foreignField: 'seller',
          as: 'shipmentStats',
          pipeline: [
            {
              $group: {
                _id: '$status',
                count: { $sum: 1 }
              }
            }
          ]
        }
      },
      // Include wallet transactions
      {
        $lookup: {
          from: 'wallettransactions',
          localField: '_id',
          foreignField: 'seller',
          as: 'walletTransactions',
          pipeline: [
            {
              $sort: {
                createdAt: -1
              }
            },
            {
              $limit: 10
            }
          ]
        }
      },
      // Include any account issues
      {
        $lookup: {
          from: 'supporttickets',
          localField: '_id',
          foreignField: 'seller',
          as: 'supportTickets',
          pipeline: [
            {
              $sort: {
                createdAt: -1
              }
            },
            {
              $limit: 5
            }
          ]
        }
      },
      {
        $project: {
          _id: 1,
          rbUserId: 1, // Include RB User ID in response
          name: 1,
          email: 1,
          phone: 1,
          businessName: 1,
          companyCategory: 1,
          brandName: 1,
          website: 1,
          supportContact: 1,
          supportEmail: 1,
          operationsEmail: 1,
          financeEmail: 1,
          gstin: 1,
          documents: 1,
          bankDetails: 1, // Add bank details to projection
          address: 1, // Add address to projection
          status: 1,
          walletBalance: 1,
          lastLogin: 1,
          lastActive: 1,
          createdAt: 1,
          updatedAt: 1,
          orders: 1,
          shipments: 1,
          orderStats: 1,
          shipmentStats: 1,
          walletTransactions: 1,
          supportTickets: 1,
          rateCardDetails: { $arrayElemAt: ['$rateCardDetails', 0] }
        }
      }
    ]);

    if (!sellerDetails || sellerDetails.length === 0) {
      logger.warn(`Seller not found with ID: ${sellerId}`);
      return next(new AppError('Seller not found', 404));
    }

    logger.info(`Found seller: ${sellerDetails[0].name} (${sellerDetails[0].email})`);

    // Extract KYC details from the seller model for backward compatibility
    const kycDetails = {
      status: sellerDetails[0].status,
      documents: sellerDetails[0].documents || {},
      businessDetails: {
        name: sellerDetails[0].businessName,
        gstin: sellerDetails[0].gstin
      }
    };

    // Get agreements
    const agreements = await Agreement.find({ seller: sellerId });

    // Construct response in the expected format
    const responseData = {
      seller: sellerDetails[0],
      kycDetails,
      agreements,
      isRealtime: false
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error(`Error in getSellerDetails: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    next(new AppError('Failed to fetch seller details', 500));
  }
};

/**
 * Update seller status
 * @route PATCH /api/v1/admin/users/sellers/:id/status
 * @access Private (Admin only)
 */
export const updateSellerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Find and update seller
    const seller = await Seller.findById(id);

    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Update status - convert from frontend format (capitalized) to backend format (lowercase)
    seller.status = status.toLowerCase();

    // Add status change to history
    seller.statusHistory = seller.statusHistory || [];
    seller.statusHistory.push({
      status: seller.status, // Use the converted lowercase status
      reason,
      updatedBy: req.user.id,
      timestamp: new Date()
    });

    await seller.save();

    // Invalidate seller cache
    try {
      invalidateCachePattern(`seller:${id}:*`);

      // Get Socket.IO instance and broadcast update
      const io = getIO();

      // Emit to admin dashboard for real-time updates
      io.to('admin-dashboard').emit('seller:profile:updated', {
        sellerId: id,
        status: seller.status,
        updatedBy: req.user.id,
        updatedAt: new Date()
      });

      // Emit to admin-seller-specific room for admins who are subscribed to this seller
      io.to(`admin-seller-${id}`).emit('seller:profile:updated', await getSellerProfile(id));

      // Emit to seller-specific room if they're connected
      io.to(`seller-${id}`).emit('seller:profile:updated', await getSellerProfile(id));

      logger.info(`Broadcasted seller profile update for ${id}`);
    } catch (error) {
      logger.warn(`Failed to broadcast seller update: ${error.message}`);
      // Don't fail the request if broadcasting fails
    }

    // Log the status update
    logger.info(`Admin ${req.user.id} updated seller ${id} status to ${status}`);

    res.status(200).json({
      success: true,
      data: {
        seller
      }
    });
  } catch (error) {
    logger.error(`Error in updateSellerStatus: ${error.message}`);
    next(new AppError('Failed to update seller status', 500));
  }
};

/**
 * Update seller KYC status
 * @route PATCH /api/v1/admin/users/sellers/:id/kyc
 * @access Private (Admin only)
 */
export const updateSellerKYC = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, comments, documentType } = req.body;

    console.log(`🔍 Admin KYC Update Request:`, {
      sellerId: id,
      status,
      documentType,
      comments,
      adminId: req.user.id
    });

    // Find seller
    const seller = await Seller.findById(id);

    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Initialize documents object if it doesn't exist
    if (!seller.documents) {
      seller.documents = {};
    }

    // Map status values to match seller profile expectations
    const mappedStatus = status === 'approved' ? 'verified' :
      status === 'rejected' ? 'rejected' : 'pending';

    console.log(`📝 Mapped status: ${status} -> ${mappedStatus}`);

    // Update specific document type if provided
    if (documentType) {
      console.log(`📄 Updating specific document: ${documentType}`);

      // Update the specific document status
      if (documentType === 'gstin') {
        if (!seller.documents.gstin) seller.documents.gstin = {};
        seller.documents.gstin.status = mappedStatus;
        console.log(`✅ Updated GST status to: ${mappedStatus}`);
      } else if (documentType === 'pan') {
        if (!seller.documents.pan) seller.documents.pan = {};
        seller.documents.pan.status = mappedStatus;
        console.log(`✅ Updated PAN status to: ${mappedStatus}`);
      } else if (documentType === 'aadhaar') {
        if (!seller.documents.aadhaar) seller.documents.aadhaar = {};
        seller.documents.aadhaar.status = mappedStatus;
        console.log(`✅ Updated Aadhaar status to: ${mappedStatus}`);
      }

      // Check if all required documents are now verified after individual document update
      const gstStatus = seller.documents.gstin?.status || 'pending';
      const panStatus = seller.documents.pan?.status || 'pending';
      const aadhaarStatus = seller.documents.aadhaar?.status || 'pending';

      const allDocumentsVerified = gstStatus === 'verified' && panStatus === 'verified' && aadhaarStatus === 'verified';

      if (allDocumentsVerified && !seller.kycVerified) {
        seller.kycVerified = true;
        console.log(`✅ All documents verified - automatically set kycVerified to true`);
      } else if (!allDocumentsVerified && seller.kycVerified) {
        seller.kycVerified = false;
        console.log(`⚠️ Document verification status changed - set kycVerified to false`);
      }
    } else {
      // Update all document statuses if no specific type provided
      console.log(`📄 Updating all document statuses to: ${mappedStatus}`);

      if (seller.documents.gstin) {
        seller.documents.gstin.status = mappedStatus;
      }
      if (seller.documents.pan) {
        seller.documents.pan.status = mappedStatus;
      }
      if (seller.documents.aadhaar) {
        seller.documents.aadhaar.status = mappedStatus;
      }

      // Also update legacy documents array if it exists
      if (seller.documents.documents && Array.isArray(seller.documents.documents)) {
        seller.documents.documents.forEach(doc => {
          doc.status = mappedStatus;
        });
      }

      // Update overall KYC verification flag for overall status changes
      seller.kycVerified = status === 'approved';
      console.log(`✅ Updated overall KYC status to: ${seller.kycVerified}`);
    }

    // Add verification history if it doesn't exist
    if (!seller.verificationHistory) {
      seller.verificationHistory = [];
    }

    // Add new verification entry
    seller.verificationHistory.push({
      status,
      documentType: documentType || 'overall',
      comments: comments || `${documentType || 'Overall KYC'} ${status} by admin`,
      verifiedBy: req.user.id,
      timestamp: new Date()
    });

    // Save the seller with updated document status
    await seller.save();

    // Clear any cached seller data
    try {
      const { deleteCache } = await import('../../../utils/cache.js');
      await deleteCache(`seller:${id}:profile`);
      await deleteCache(`seller_profile:${id}`);
      console.log(`🗑️ Cleared seller profile cache for ${id}`);
    } catch (cacheError) {
      console.warn(`⚠️ Failed to clear cache: ${cacheError.message}`);
    }

    // Emit real-time update for seller profile refresh
    try {
      const { getIO } = await import('../../../utils/socketio.js');
      const io = getIO();

      // Emit to seller-specific room to trigger profile refresh
      io.to(`seller:${id}`).emit('profile:updated', {
        message: 'KYC documents updated by admin',
        documents: seller.documents,
        timestamp: new Date()
      });

      // Emit to admin dashboard
      io.to('admin-dashboard').emit('seller:kyc:updated', {
        sellerId: id,
        documentType: documentType || 'overall',
        status: mappedStatus,
        updatedBy: req.user.id,
        timestamp: new Date()
      });

      console.log(`📡 Emitted real-time updates for seller ${id}`);
    } catch (socketError) {
      console.warn(`⚠️ Failed to emit real-time updates: ${socketError.message}`);
    }

    // Log the KYC update
    console.log(`✅ Admin ${req.user.id} updated seller ${id} ${documentType || 'overall'} KYC status to ${status}`);
    logger.info(`Admin ${req.user.id} updated seller ${id} ${documentType || 'overall'} KYC status to ${status}`);

    res.status(200).json({
      success: true,
      data: {
        seller: {
          id: seller._id,
          name: seller.name,
          email: seller.email,
          documents: seller.documents,
          kycVerified: seller.kycVerified
        }
      },
      message: `${documentType ? documentType.toUpperCase() + ' document' : 'KYC'} ${status === 'approved' ? 'verified' : status} successfully`
    });
  } catch (error) {
    console.error(`❌ Error in updateSellerKYC: ${error.message}`);
    logger.error(`Error in updateSellerKYC: ${error.message}`);
    next(new AppError('Failed to update seller KYC status', 500));
  }
};

/**
 * Update seller bank details
 * @route PATCH /api/v2/admin/users/sellers/:id/bank-details
 * @access Private (Admin only)
 */
export const updateSellerBankDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { bankDetails } = req.body;

    // Validate required fields
    if (!bankDetails) {
      return next(new AppError('Bank details are required', 400));
    }

    // Find seller
    const seller = await Seller.findById(id);

    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Update bank details
    seller.bankDetails = {
      ...seller.bankDetails,
      ...bankDetails
    };

    // If cancelled cheque status is being updated, log the action
    if (bankDetails.cancelledCheque && bankDetails.cancelledCheque.status) {
      logger.info(`Admin ${req.user.id} updated cancelled cheque status to ${bankDetails.cancelledCheque.status} for seller ${id}`);
    }

    await seller.save();

    // Invalidate seller cache
    try {
      invalidateCachePattern(`seller:${id}:*`);

      // Get Socket.IO instance and broadcast update
      const io = getIO();

      // Emit to admin dashboard for real-time updates
      io.to('admin-dashboard').emit('seller:bank-details:updated', {
        sellerId: id,
        bankDetails: seller.bankDetails,
        updatedBy: req.user.id,
        updatedAt: new Date()
      });

      // Emit to admin-seller-specific room for admins who are subscribed to this seller
      io.to(`admin-seller-${id}`).emit('seller:bank-details:updated', {
        bankDetails: seller.bankDetails
      });

      logger.info(`Broadcasted seller bank details update for ${id}`);
    } catch (error) {
      logger.warn(`Failed to broadcast seller bank details update: ${error.message}`);
      // Don't fail the request if broadcasting fails
    }

    // Log the bank details update
    logger.info(`Admin ${req.user.id} updated bank details for seller ${id}`);

    res.status(200).json({
      success: true,
      data: {
        seller: {
          id: seller._id,
          name: seller.name,
          email: seller.email,
          bankDetails: seller.bankDetails
        }
      },
      message: 'Bank details updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateSellerBankDetails: ${error.message}`);
    next(new AppError('Failed to update seller bank details', 500));
  }
};

/**
 * Create a new agreement for seller
 * @route POST /api/v1/admin/users/sellers/:id/agreements
 * @access Private (Admin only)
 */
export const createSellerAgreement = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { title, content, validFrom, validTo, isActive } = req.body;

    // Find seller
    const seller = await Seller.findById(id);

    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Create new agreement
    const agreement = new Agreement({
      seller: id,
      title,
      content,
      validFrom,
      validTo,
      isActive,
      createdBy: req.user.id
    });

    await agreement.save();

    // Log the agreement creation
    logger.info(`Admin ${req.user.id} created new agreement for seller ${id}`);

    res.status(201).json({
      success: true,
      data: {
        agreement
      }
    });
  } catch (error) {
    logger.error(`Error in createSellerAgreement: ${error.message}`);
    next(new AppError('Failed to create seller agreement', 500));
  }
};

/**
 * Create or update seller-specific rate card overrides
 * @route POST /api/v1/admin/users/sellers/:id/ratecards
 * @access Private (Admin only)
 */
export const manageSellerRateCard = async (req, res, next) => {
  try {
    const { id: sellerId } = req.params;
    const { rateCards } = req.body; // Expecting array of rate card override objects

    // Find seller
    const seller = await Seller.findById(sellerId);

    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    if (!Array.isArray(rateCards)) {
      return next(new AppError('Rate cards must be an array', 400));
    }

    const createdOverrides = [];
    const updatedOverrides = [];
    const errors = [];

    // Process each rate card override
    for (const rateCardData of rateCards) {
      try {
        // Validate required fields
        const requiredFields = ['courier', 'productName', 'mode', 'zone'];
        const missingFields = requiredFields.filter(field => !rateCardData[field]);

        if (missingFields.length > 0) {
          errors.push(`Missing required fields: ${missingFields.join(', ')} for rate card: ${JSON.stringify(rateCardData)}`);
          continue;
        }

        // Create or update seller rate card override
        const result = await SellerRateCard.createOrUpdateOverride(
          sellerId,
          rateCardData,
          req.user.id
        );

        if (result.isNew) {
          createdOverrides.push(result.override);
        } else {
          updatedOverrides.push(result.override);
        }

      } catch (cardError) {
        errors.push(`Error processing rate card override: ${cardError.message}`);
        logger.error(`Rate card override error for seller ${sellerId}:`, cardError);
      }
    }

    // Log the operation
    logger.info(`Admin ${req.user.id} processed rate card overrides for seller ${sellerId}: ${createdOverrides.length} created, ${updatedOverrides.length} updated, ${errors.length} errors`);

    // Get effective rate cards for the seller (base + overrides)
    const effectiveRates = await SellerRateCard.getSellerEffectiveRates(sellerId);

    res.status(200).json({
      success: true,
      data: {
        created: createdOverrides,
        updated: updatedOverrides,
        errors: errors.length > 0 ? errors : undefined,
        effectiveRates: effectiveRates,
        summary: {
          totalProcessed: rateCards.length,
          created: createdOverrides.length,
          updated: updatedOverrides.length,
          failed: errors.length,
          totalEffectiveRates: effectiveRates.length,
          overriddenRates: effectiveRates.filter(rate => rate.isOverride).length
        }
      },
      message: `Rate card overrides processed successfully. ${createdOverrides.length + updatedOverrides.length} overrides applied to seller.`
    });
  } catch (error) {
    logger.error(`Error in manageSellerRateCard: ${error.message}`);
    next(new AppError('Failed to manage seller rate card overrides', 500));
  }
};

/**
 * Get seller's effective rate cards (base + overrides)
 * @route GET /api/v1/admin/users/sellers/:id/ratecards
 * @access Private (Admin only)
 */
export const getSellerRateCards = async (req, res, next) => {
  try {
    const { id: sellerId } = req.params;

    // Verify seller exists
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Get effective rate cards (base + overrides)
    const effectiveRates = await SellerRateCard.getSellerEffectiveRates(sellerId);

    // Get base rate cards for comparison
    const baseRateCards = await RateCard.find({ isActive: true }).lean();

    // Get seller's overrides
    const sellerOverrides = await SellerRateCard.find({
      seller: sellerId,
      isActive: true
    }).populate('createdBy updatedBy', 'fullName email').lean();

    // Statistics
    const stats = {
      totalBaseRates: baseRateCards.length,
      totalEffectiveRates: effectiveRates.length,
      overriddenRates: effectiveRates.filter(rate => rate.isOverride).length,
      overridePercentage: Math.round((effectiveRates.filter(rate => rate.isOverride).length / effectiveRates.length) * 100)
    };

    res.status(200).json({
      success: true,
      data: {
        seller: {
          id: seller._id,
          companyName: seller.companyName,
          email: seller.email,
          status: seller.status
        },
        effectiveRates,
        baseRateCards,
        sellerOverrides,
        statistics: stats
      }
    });

  } catch (error) {
    logger.error(`Error in getSellerRateCards: ${error.message}`);
    next(new AppError('Failed to fetch seller rate cards', 500));
  }
};

/**
 * Remove seller rate card override (revert to base rate)
 * @route DELETE /api/v1/admin/users/sellers/:id/ratecards/:overrideId
 * @access Private (Admin only)
 */
export const removeSellerRateCardOverride = async (req, res, next) => {
  try {
    const { id: sellerId, overrideId } = req.params;

    // Verify seller exists
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Find and remove the override
    const override = await SellerRateCard.findOneAndDelete({
      _id: overrideId,
      seller: sellerId
    });

    if (!override) {
      return next(new AppError('Rate card override not found', 404));
    }

    logger.info(`Admin ${req.user.id} removed rate card override ${overrideId} for seller ${sellerId}`);

    res.status(200).json({
      success: true,
      data: {
        removedOverride: override
      },
      message: `Rate card override removed. Seller will now use base rate for ${override.courier} - ${override.productName} - ${override.mode} - ${override.zone}.`
    });

  } catch (error) {
    logger.error(`Error in removeSellerRateCardOverride: ${error.message}`);
    next(new AppError('Failed to remove seller rate card override', 500));
  }
};

/**
 * Update seller rate band assignment
 * @route PATCH /api/v1/admin/users/sellers/:id/rate-band
 * @access Private (Admin only)
 */
export const updateSellerRateBand = async (req, res, next) => {
  try {
    const { id: sellerId } = req.params;
    const { rateBand, paymentType, creditLimit, creditPeriod } = req.body;

    // Verify seller exists
    const seller = await Seller.findById(sellerId);
    if (!seller) {
      return next(new AppError('Seller not found', 404));
    }

    // Update rate band and payment settings
    const updates = {};
    if (rateBand !== undefined) {
      updates.rateBand = rateBand === 'RBX1' ? null : rateBand; // null means default RBX1
    }
    if (paymentType !== undefined) {
      updates.paymentType = paymentType;
    }
    if (creditLimit !== undefined) {
      updates.creditLimit = creditLimit;
    }
    if (creditPeriod !== undefined) {
      updates.creditPeriod = creditPeriod;
    }

    // Apply updates
    Object.assign(seller, updates);
    await seller.save();

    // Log the rate band update
    logger.info(`Admin ${req.user.id} updated seller ${sellerId} rate band to ${rateBand || 'RBX1 (default)'}`);

    // Clear any cached seller data
    try {
      const { deleteCache } = await import('../../../utils/cache.js');
      await deleteCache(`seller:${sellerId}:profile`);
      await deleteCache(`seller_profile:${sellerId}`);
      console.log(`🗑️ Cleared seller profile cache for ${sellerId}`);
    } catch (cacheError) {
      console.warn(`⚠️ Failed to clear cache: ${cacheError.message}`);
    }

    // Emit real-time update for seller profile refresh
    try {
      const { getIO } = await import('../../../utils/socketio.js');
      const io = getIO();

      // Emit to seller-specific room to trigger profile refresh
      io.to(`seller:${sellerId}`).emit('profile:updated', {
        message: 'Rate band updated by admin',
        rateBand: rateBand || 'RBX1',
        paymentSettings: { paymentType, creditLimit, creditPeriod },
        timestamp: new Date()
      });

      // Emit to admin dashboard
      io.to('admin-dashboard').emit('seller:rate-band:updated', {
        sellerId: sellerId,
        rateBand: rateBand || 'RBX1',
        updatedBy: req.user.id,
        timestamp: new Date()
      });

      console.log(`📡 Emitted real-time rate band updates for seller ${sellerId}`);
    } catch (socketError) {
      console.warn(`⚠️ Failed to emit real-time updates: ${socketError.message}`);
    }

    res.status(200).json({
      success: true,
      data: {
        seller: {
          id: seller._id,
          name: seller.name,
          email: seller.email,
          rateBand: seller.rateBand || 'RBX1',
          paymentType: seller.paymentType,
          creditLimit: seller.creditLimit,
          creditPeriod: seller.creditPeriod
        }
      },
      message: `Rate band updated to ${rateBand || 'RBX1 (default)'} successfully`
    });

  } catch (error) {
    logger.error(`Error in updateSellerRateBand: ${error.message}`);
    next(new AppError('Failed to update seller rate band', 500));
  }
};

/**
 * Get all customers with pagination and filters
 * @route GET /api/v1/admin/users/customers
 * @access Private (Admin only)
 */
export const getAllCustomers = async (req, res, next) => {
  try {
    logger.info(`getAllCustomers called with query: ${JSON.stringify(req.query)}`);

    const {
      page = 1,
      limit = 10,
      sortBy = 'createdAt',
      sortField = 'createdAt', // Support both sortBy and sortField
      sortOrder = 'desc',
      status,
      search
    } = req.query;

    // Use sortField if provided, otherwise fallback to sortBy
    let actualSortField = sortField || sortBy;

    // Map frontend field names to database field names
    const fieldMapping = {
      'userId': '_id',
      'name': 'name',
      'email': 'email',
      'status': 'status',
      'createdAt': 'createdAt',
      'lastActive': 'lastActive'
    };

    // Apply field mapping
    actualSortField = fieldMapping[actualSortField] || actualSortField;

    logger.info(`Using sort field: ${actualSortField}, direction: ${sortOrder}`);

    // Build query - explicitly handle all statuses for admin
    const query = {};

    // Add status filter if provided
    if (status && status !== 'all') {
      query.status = status;
    }
    // For admin, don't apply default status filter - get all customers

    // Add search filter if provided
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } }
      ];
    }

    logger.info(`Database query: ${JSON.stringify(query)}`);

    // Execute query with pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const sortDirection = sortOrder === 'desc' ? -1 : 1;

    logger.info(`Pagination: skip=${skip}, limit=${limit}, sort={${actualSortField}: ${sortDirection}}`);

    // Use aggregate to bypass pre-find middleware issues
    const pipeline = [
      { $match: query },
      { $sort: { [actualSortField]: sortDirection } },
      { $skip: skip },
      { $limit: parseInt(limit) }
    ];

    // Get customers using aggregation to avoid middleware issues
    const customers = await Customer.aggregate(pipeline);

    logger.info(`Found ${customers.length} customers via aggregation`);

    // Get total count using aggregation
    const countPipeline = [
      { $match: query },
      { $count: "total" }
    ];

    const countResult = await Customer.aggregate(countPipeline);
    const totalCustomers = countResult.length > 0 ? countResult[0].total : 0;

    logger.info(`Total customers count: ${totalCustomers}`);

    // Transform customers to match frontend expectations
    const transformedCustomers = customers.map(customer => ({
      id: customer._id ? customer._id.toString() : '',
      userId: customer.rbUserId || customer._id.toString(), // Use RB ID if available, fallback to ObjectId
      name: customer.name || '',
      email: customer.email || '',
      status: customer.status || 'active',
      createdAt: customer.createdAt,
      lastActive: customer.lastActive,
      paymentType: 'wallet', // Default value
      totalTransactions: 0 // Default value, can be enhanced later
    }));

    logger.info(`Transformed ${transformedCustomers.length} customers for response`);

    res.status(200).json({
      success: true,
      data: {
        customers: transformedCustomers,
        users: transformedCustomers, // Alias for frontend compatibility
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(totalCustomers / parseInt(limit)),
          totalResults: totalCustomers
        }
      }
    });
  } catch (error) {
    logger.error(`Error in getAllCustomers: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    next(new AppError('Failed to fetch customers', 500));
  }
};

/**
 * Get customer details by ID with profile information
 * @route GET /api/v1/admin/users/customers/:id
 * @access Private (Admin only)
 */
export const getCustomerDetails = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      logger.warn(`Invalid ObjectId for customer details: ${id}`);
      return next(new AppError('Invalid customer ID format', 400));
    }

    logger.info(`Getting customer details for ID: ${id}`);

    // Get real-time customer profile data
    let customerProfile;
    try {
      customerProfile = await getCustomerProfile(id);
    } catch (error) {
      logger.warn(`Failed to get customer profile from cache: ${error.message}`);
      // Fall back to database query if cache fails
      customerProfile = null;
    }

    // Get customer details from database if not available from real-time service
    const customer = customerProfile || await Customer.findById(id, null, { skipDefaultFilter: true });

    if (!customer) {
      logger.warn(`Customer not found with ID: ${id}`);
      return next(new AppError('Customer not found', 404));
    }

    logger.info(`Found customer: ${customer.name} (${customer.email})`);

    // Get addresses if they exist and weren't included in profile
    let addresses = [];
    if (customer.addresses && customer.addresses.length > 0) {
      addresses = customer.addresses;
    }

    // Add real-time flag to indicate if data came from real-time cache
    const responseData = {
      customer,
      addresses,
      isRealtime: !!customerProfile
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error(`Error in getCustomerDetails: ${error.message}`);
    logger.error(`Stack trace: ${error.stack}`);
    next(new AppError('Failed to fetch customer details', 500));
  }
};

/**
 * Update customer status
 * @route PATCH /api/v1/admin/users/customers/:id/status
 * @access Private (Admin only)
 */
export const updateCustomerStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Find and update customer
    const customer = await Customer.findById(id, null, { skipDefaultFilter: true });

    if (!customer) {
      return next(new AppError('Customer not found', 404));
    }

    // Update status
    customer.status = status;

    // Add status change to history if it exists
    if (!customer.statusHistory) {
      customer.statusHistory = [];
    }

    customer.statusHistory.push({
      status,
      reason,
      updatedBy: req.user.id,
      timestamp: new Date()
    });

    await customer.save();

    // Invalidate customer cache
    try {
      invalidateCachePattern(`customer:${id}:*`);

      // Get Socket.IO instance and broadcast update
      const io = getIO();

      // Emit to admin dashboard for real-time updates
      io.to('admin-dashboard').emit('customer:profile:updated', {
        customerId: id,
        status: customer.status,
        updatedBy: req.user.id,
        updatedAt: new Date()
      });

      // Emit to admin-customer-specific room for admins who are subscribed to this customer
      io.to(`admin-customer-${id}`).emit('customer:profile:updated', await getCustomerProfile(id));

      // Emit to customer-specific room if they're connected
      io.to(`customer-${id}`).emit('customer:profile:updated', await getCustomerProfile(id));

      logger.info(`Broadcasted customer profile update for ${id}`);
    } catch (error) {
      logger.warn(`Failed to broadcast customer update: ${error.message}`);
      // Don't fail the request if broadcasting fails
    }

    // Log the status update
    logger.info(`Admin ${req.user.id} updated customer ${id} status to ${status}`);

    res.status(200).json({
      success: true,
      data: {
        customer
      }
    });
  } catch (error) {
    logger.error(`Error in updateCustomerStatus: ${error.message}`);
    next(new AppError('Failed to update customer status', 500));
  }
};

/**
 * Get real-time profile data for multiple customers and sellers
 * @route POST /api/v1/admin/users/realtime
 * @access Private (Admin only)
 */
export const getRealtimeUserData = async (req, res, next) => {
  try {
    const { sellerIds = [], customerIds = [] } = req.body;

    // Validate input
    if (!Array.isArray(sellerIds) || !Array.isArray(customerIds)) {
      return next(new AppError('Invalid input format. sellerIds and customerIds must be arrays', 400));
    }

    // Limit the number of IDs that can be queried at once to prevent abuse
    const MAX_IDS = 20;
    if (sellerIds.length + customerIds.length > MAX_IDS) {
      return next(new AppError(`Too many IDs requested. Maximum ${MAX_IDS} total IDs allowed`, 400));
    }

    logger.info(`Fetching real-time profile data for ${sellerIds.length} sellers and ${customerIds.length} customers`);

    // Get seller profiles in parallel
    const sellerPromises = sellerIds.map(async (id) => {
      try {
        return await getSellerProfile(id);
      } catch (error) {
        logger.warn(`Failed to get real-time seller profile for ${id}: ${error.message}`);
        // Return basic info on error
        return { id, error: 'Failed to fetch real-time data' };
      }
    });

    // Get customer profiles in parallel
    const customerPromises = customerIds.map(async (id) => {
      try {
        return await getCustomerProfile(id);
      } catch (error) {
        logger.warn(`Failed to get real-time customer profile for ${id}: ${error.message}`);
        // Return basic info on error
        return { id, error: 'Failed to fetch real-time data' };
      }
    });

    // Wait for all promises to resolve
    const [sellers, customers] = await Promise.all([
      Promise.all(sellerPromises),
      Promise.all(customerPromises)
    ]);

    res.status(200).json({
      success: true,
      data: {
        sellers,
        customers,
        timestamp: new Date()
      }
    });
  } catch (error) {
    logger.error(`Error in getRealtimeUserData: ${error.message}`);
    next(new AppError('Failed to fetch real-time user data', 500));
  }
};
