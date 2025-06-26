import mongoose from 'mongoose';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import SellerShipment from '../../seller/models/shipment.model.js';
import AdminShipment from '../models/shipment.model.js';
import ShippingPartner from '../models/shippingPartner.model.js';

/**
 * Get all shipments with filtering, sorting, and pagination
 * @route GET /api/v2/admin/shipments
 * @access Private (Admin only)
 */
export const getShipments = async (req, res, next) => {
  try {
    const {
      awb,
      courier,
      status,
      startDate,
      endDate,
      sellerId,
      customerPhone,
      customerEmail,
      sort = '-createdAt',
      limit = 20,
      page = 1
    } = req.query;

    console.log('🔄 Admin getShipments called with params:', req.query);

    // Build filter object
    const filter = {};
    if (awb) filter.awb = new RegExp(awb, 'i');
    if (courier) filter.courier = new RegExp(courier, 'i');
    if (status) filter.status = status;
    if (sellerId) filter.seller = sellerId;

    // Date filters
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) {
        const endDateObj = new Date(endDate);
        endDateObj.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = endDateObj;
      }
    }

    console.log('📝 Filter object:', filter);

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    console.log('📄 Pagination:', { pageNum, limitNum, skip });

    // Execute query without population to avoid ObjectId cast errors
    const [shipments, total] = await Promise.all([
      SellerShipment.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      SellerShipment.countDocuments(filter)
    ]);

    console.log(`📦 Found ${shipments.length} shipments out of ${total} total`);

    // Transform data to match frontend expectations
    const transformedShipments = shipments.map(shipment => {
      console.log(`🔄 Transforming shipment: ${shipment.awb}`);

      // Handle different data structures
      let customerInfo = {
        name: 'N/A',
        phone: null,
        email: null
      };

      let sellerInfo = {
        name: 'N/A',
        businessName: 'N/A'
      };

      let codAmount = 0;
      let isCod = false;

      // Check if seller is a string (embedded data) or ObjectId (reference)
      if (typeof shipment.seller === 'string') {
        // Use embedded seller data
        sellerInfo.name = shipment.sellerName || shipment.seller;
        sellerInfo.businessName = shipment.sellerName || shipment.seller;
      }

      // Check if we have embedded customer data
      if (shipment.customerName) {
        customerInfo.name = shipment.customerName;
      }

      // Check payment info
      if (shipment.paymentMethod) {
        isCod = shipment.paymentMethod === 'COD';
        codAmount = isCod && shipment.amount ? shipment.amount : 0;
      }

      return {
        _id: shipment._id,
        orderId: shipment.orderId,
        awb: shipment.awb,
        createdAt: shipment.createdAt,
        pickupDate: shipment.pickupDate,
        customer: customerInfo,
        seller: sellerInfo,
        courier: shipment.courier || 'N/A',
        status: shipment.status || 'Unknown',
        weight: shipment.weight ? parseFloat(shipment.weight) : null,
        shippingCharge: shipment.shippingCharge ? parseFloat(shipment.shippingCharge) : 0,
        codAmount: codAmount,
        isCod: isCod,
        channel: shipment.channel || 'MANUAL',
        trackingUrl: shipment.trackingHistory?.length > 0 ?
          `https://track.example.com/${shipment.awb}` : null
      };
    });

    console.log('✅ Transformed shipments sample:', transformedShipments.slice(0, 2));

    res.status(200).json({
      success: true,
      count: transformedShipments.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: transformedShipments
    });
  } catch (error) {
    console.error('❌ Error in getShipments:', error.message);
    console.error('❌ Error stack:', error.stack);
    logger.error(`Error in getShipments: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

/**
 * Get shipment by ID
 * @route GET /api/v2/admin/shipments/:id
 * @access Private (Admin only)
 */
export const getShipmentById = async (req, res, next) => {
  try {
    const { id } = req.params;

    console.log('🔄 Getting shipment by ID:', id);

    // Check for valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid shipment ID', 400));
    }

    const shipment = await SellerShipment.findById(id)
      .populate({
        path: 'seller',
        select: 'name email phone businessName address'
      })
      .populate({
        path: 'orderId',
        select: 'customer orderDate payment product'
      })
      .lean();

    if (!shipment) {
      return next(new AppError('Shipment not found', 404));
    }

    console.log('✅ Found shipment:', shipment.awb);

    // Transform single shipment data
    const transformedShipment = {
      _id: shipment._id,
      orderId: shipment.orderId?._id,
      awb: shipment.awb,
      createdAt: shipment.createdAt,
      pickupDate: shipment.pickupDate,
      deliveryDate: shipment.deliveryDate,
      customer: {
        name: shipment.orderId?.customer?.name || 'N/A',
        phone: shipment.orderId?.customer?.phone || null,
        email: shipment.orderId?.customer?.email || null
      },
      seller: {
        id: shipment.seller?._id,
        name: shipment.seller?.name || 'N/A',
        businessName: shipment.seller?.businessName || shipment.seller?.name || 'N/A',
        email: shipment.seller?.email,
        phone: shipment.seller?.phone
      },
      courier: shipment.courier || 'N/A',
      status: shipment.status || 'Unknown',
      weight: shipment.weight ? parseFloat(shipment.weight) : null,
      dimensions: shipment.dimensions,
      shippingCharge: shipment.shippingCharge ? parseFloat(shipment.shippingCharge) : 0,
      codAmount: shipment.orderId?.payment?.method === 'COD' ? parseFloat(shipment.orderId.payment.total || 0) : 0,
      isCod: shipment.orderId?.payment?.method === 'COD',
      channel: shipment.channel || 'MANUAL',
      trackingHistory: shipment.trackingHistory || [],
      trackingUrl: shipment.trackingHistory?.length > 0 ?
        `https://track.example.com/${shipment.awb}` : null
    };

    res.status(200).json({
      success: true,
      data: transformedShipment
    });
  } catch (error) {
    console.error('❌ Error in getShipmentById:', error.message);
    logger.error(`Error in getShipmentById: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

/**
 * Sync shipment data from seller shipments
 * @route POST /api/v2/admin/shipments/sync
 * @access Private (Admin only)
 */
export const syncShipments = async (req, res, next) => {
  try {
    const { fromDate, sellerId } = req.body;

    // Prepare filter for seller shipments
    const filter = {};
    if (fromDate) {
      filter.createdAt = { $gte: new Date(fromDate) };
    } else {
      // Default to last 24 hours if no date provided
      const oneDayAgo = new Date();
      oneDayAgo.setDate(oneDayAgo.getDate() - 1);
      filter.createdAt = { $gte: oneDayAgo };
    }

    if (sellerId) {
      filter.seller = sellerId;
    }

    // Get all seller shipments matching the filter
    const sellerShipments = await SellerShipment.find(filter)
      .populate({
        path: 'seller',
        select: 'name email phone businessName'
      })
      .populate({
        path: 'orderId',
        select: 'orderNumber customer shippingAddress paymentMethod totalAmount items'
      });

    if (sellerShipments.length === 0) {
      return res.status(200).json({
        success: true,
        message: 'No new shipments found to sync',
        syncedCount: 0
      });
    }

    let syncedCount = 0;
    let skippedCount = 0;
    const errors = [];

    // Process each seller shipment
    for (const sellerShipment of sellerShipments) {
      try {
        // Check if shipment is already synced
        const existingShipment = await AdminShipment.findOne({
          originalShipment: sellerShipment._id
        });

        if (existingShipment) {
          // Update existing shipment
          existingShipment.status = sellerShipment.status;
          existingShipment.trackingHistory = sellerShipment.trackingHistory;
          existingShipment.deliveryDate = sellerShipment.deliveryDate;
          existingShipment.updatedAt = new Date();
          existingShipment.lastSyncAt = new Date();
          existingShipment.lastSyncedBy = req.user.id;

          await existingShipment.save();
          skippedCount++;
        } else {
          // Find partner ID if available
          let partnerId = null;
          if (sellerShipment.courier) {
            const partner = await ShippingPartner.findOne({
              name: { $regex: new RegExp(sellerShipment.courier, 'i') }
            });
            if (partner) {
              partnerId = partner._id;
            }
          }

          // Create new admin shipment
          const adminShipment = new AdminShipment({
            originalShipment: sellerShipment._id,
            order: sellerShipment.orderId._id,
            orderModel: 'SellerOrder',
            seller: {
              id: sellerShipment.seller._id,
              name: sellerShipment.seller.name,
              email: sellerShipment.seller.email,
              phone: sellerShipment.seller.phone,
              businessName: sellerShipment.seller.businessName
            },
            customer: sellerShipment.orderId.customer,
            awb: sellerShipment.awb,
            courier: sellerShipment.courier,
            partnerId: partnerId,
            status: sellerShipment.status,
            pickupDate: sellerShipment.pickupDate,
            deliveryDate: sellerShipment.deliveryDate,
            weight: sellerShipment.weight,
            dimensions: sellerShipment.dimensions,
            shippingCharge: sellerShipment.shippingCharge,
            codAmount: sellerShipment.orderId.paymentMethod === 'COD' ? sellerShipment.orderId.totalAmount : 0,
            isCod: sellerShipment.orderId.paymentMethod === 'COD',
            deliveryAddress: sellerShipment.orderId.shippingAddress,
            trackingHistory: sellerShipment.trackingHistory,
            trackingUrl: sellerShipment.trackingUrl,
            channel: sellerShipment.channel,
            lastSyncAt: new Date(),
            lastSyncedBy: req.user.id
          });

          await adminShipment.save();
          syncedCount++;
        }
      } catch (error) {
        errors.push({
          shipmentId: sellerShipment._id,
          awb: sellerShipment.awb,
          error: error.message
        });
        logger.error(`Error syncing shipment ${sellerShipment.awb}: ${error.message}`);
      }
    }

    res.status(200).json({
      success: true,
      message: `Synced ${syncedCount} shipments, updated ${skippedCount} existing shipments`,
      syncedCount,
      skippedCount,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};
