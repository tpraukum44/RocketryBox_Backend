import ShippingCharge from '../models/shippingCharge.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import mongoose from 'mongoose';
import { generateCSV, generateXLSX } from '../../../utils/exportHelpers.js';

// Helper function to format shipping charge for response
const formatShippingCharge = (charge) => {
  return {
    id: charge._id,
    sellerId: charge.sellerId._id || charge.sellerId,
    sellerName: charge.sellerName,
    courierName: charge.courierName,
    courierMode: charge.courierMode || '',
    airwaybillNumber: charge.airwaybillNumber,
    orderNumber: charge.orderNumber,
    date: charge.date,
    time: charge.time || '',
    shipmentType: charge.shipmentType,
    productType: charge.productType || '',
    originPincode: charge.originPincode,
    destinationPincode: charge.destinationPincode,
    originCity: charge.originCity || '',
    destinationCity: charge.destinationCity || '',
    bookedWeight: charge.bookedWeight,
    volWeight: charge.volWeight || '',
    chargeableAmount: `₹${charge.chargeableAmount.toFixed(2)}`,
    declaredValue: charge.declaredValue ? `₹${charge.declaredValue.toFixed(2)}` : '',
    collectableValue: charge.collectableValue ? `₹${charge.collectableValue.toFixed(2)}` : '',
    freightCharge: `₹${charge.freightCharge.toFixed(2)}`,
    codCharge: `₹${charge.codCharge.toFixed(2)}`,
    amountBeforeDiscount: `₹${charge.amountBeforeDiscount.toFixed(2)}`,
    discount: `₹${charge.discount.toFixed(2)}`,
    amountAfterDiscount: `₹${charge.amountAfterDiscount.toFixed(2)}`,
    status: charge.status,
    billableLane: charge.billableLane || '',
    customerGstState: charge.customerGstState || '',
    customerGstin: charge.customerGstin || ''
  };
};

// Get shipping charges with pagination and filtering
export const getShippingCharges = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sellerId, 
      courierName, 
      status, 
      from, 
      to, 
      orderNumber,
      airwaybillNumber
    } = req.query;
    
    // Build filter query
    const query = {};
    
    if (sellerId) {
      query.sellerId = sellerId;
    }
    
    if (courierName) {
      query.courierName = { $regex: courierName, $options: 'i' };
    }
    
    if (status) {
      query.status = status;
    }
    
    if (from || to) {
      query.date = {};
      if (from) {
        query.date.$gte = new Date(from);
      }
      if (to) {
        query.date.$lte = new Date(to);
      }
    }
    
    if (orderNumber) {
      query.orderNumber = { $regex: orderNumber, $options: 'i' };
    }
    
    if (airwaybillNumber) {
      query.airwaybillNumber = { $regex: airwaybillNumber, $options: 'i' };
    }
    
    // Get total count for pagination
    const total = await ShippingCharge.countDocuments(query);
    
    // Get shipping charges with pagination
    const shippingCharges = await ShippingCharge.find(query)
      .sort({ date: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('sellerId', 'name email')
      .exec();
    
    // Format shipping charges for response
    const formattedCharges = shippingCharges.map(formatShippingCharge);
    
    res.status(200).json({
      success: true,
      data: formattedCharges,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error in getShippingCharges: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get shipping charge by ID
export const getShippingChargeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // Validate shipping charge ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid shipping charge ID', 400));
    }
    
    // Find shipping charge
    const shippingCharge = await ShippingCharge.findById(id)
      .populate('sellerId', 'name email')
      .exec();
    
    if (!shippingCharge) {
      return next(new AppError('Shipping charge not found', 404));
    }
    
    // Format shipping charge for response
    const formattedCharge = formatShippingCharge(shippingCharge);
    
    res.status(200).json({
      success: true,
      data: formattedCharge
    });
  } catch (error) {
    logger.error(`Error in getShippingChargeById: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Create a new shipping charge
export const createShippingCharge = async (req, res, next) => {
  try {
    const {
      sellerId,
      sellerName,
      courierName,
      courierMode,
      airwaybillNumber,
      orderNumber,
      date,
      time,
      shipmentType,
      productType,
      originPincode,
      destinationPincode,
      originCity,
      destinationCity,
      bookedWeight,
      volWeight,
      chargeableAmount,
      declaredValue,
      collectableValue,
      freightCharge,
      codCharge,
      amountBeforeDiscount,
      discount,
      amountAfterDiscount,
      status,
      billableLane,
      customerGstState,
      customerGstin
    } = req.body;
    
    // Create new shipping charge
    const newShippingCharge = await ShippingCharge.create({
      sellerId,
      sellerName,
      courierName,
      courierMode,
      airwaybillNumber,
      orderNumber,
      date: new Date(date),
      time,
      shipmentType,
      productType,
      originPincode,
      destinationPincode,
      originCity,
      destinationCity,
      bookedWeight,
      volWeight,
      chargeableAmount,
      declaredValue,
      collectableValue,
      freightCharge,
      codCharge: codCharge || 0,
      amountBeforeDiscount,
      discount: discount || 0,
      amountAfterDiscount,
      status: status || 'in_transit',
      billableLane,
      customerGstState,
      customerGstin,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    // Format shipping charge for response
    const formattedCharge = formatShippingCharge(newShippingCharge);
    
    res.status(201).json({
      success: true,
      data: formattedCharge,
      message: 'Shipping charge created successfully'
    });
  } catch (error) {
    logger.error(`Error in createShippingCharge: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update shipping charge status
export const updateShippingChargeStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    
    // Validate shipping charge ID
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid shipping charge ID', 400));
    }
    
    // Find and update shipping charge
    const shippingCharge = await ShippingCharge.findByIdAndUpdate(
      id,
      {
        status,
        updatedBy: req.user.id
      },
      { new: true }
    ).populate('sellerId', 'name email');
    
    if (!shippingCharge) {
      return next(new AppError('Shipping charge not found', 404));
    }
    
    // Format shipping charge for response
    const formattedCharge = formatShippingCharge(shippingCharge);
    
    res.status(200).json({
      success: true,
      data: formattedCharge,
      message: 'Shipping charge status updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateShippingChargeStatus: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Export shipping charges
export const exportShippingCharges = async (req, res, next) => {
  try {
    const { 
      sellerId, 
      courierName, 
      status, 
      from, 
      to, 
      orderNumber,
      airwaybillNumber,
      format = 'csv'
    } = req.query;
    
    // Build filter query
    const query = {};
    
    if (sellerId) {
      query.sellerId = sellerId;
    }
    
    if (courierName) {
      query.courierName = { $regex: courierName, $options: 'i' };
    }
    
    if (status) {
      query.status = status;
    }
    
    if (from || to) {
      query.date = {};
      if (from) {
        query.date.$gte = new Date(from);
      }
      if (to) {
        query.date.$lte = new Date(to);
      }
    }
    
    if (orderNumber) {
      query.orderNumber = { $regex: orderNumber, $options: 'i' };
    }
    
    if (airwaybillNumber) {
      query.airwaybillNumber = { $regex: airwaybillNumber, $options: 'i' };
    }
    
    // Get shipping charges
    const shippingCharges = await ShippingCharge.find(query)
      .sort({ date: -1 })
      .populate('sellerId', 'name email')
      .exec();
    
    if (shippingCharges.length === 0) {
      return next(new AppError('No shipping charges found for export', 404));
    }
    
    // Format data for export
    const exportData = shippingCharges.map(charge => ({
      'Date': new Date(charge.date).toLocaleDateString(),
      'Time': charge.time || '',
      'Order Number': charge.orderNumber,
      'Airway Bill Number': charge.airwaybillNumber,
      'Courier': charge.courierName,
      'Mode': charge.courierMode || '',
      'Seller': charge.sellerName,
      'Origin': `${charge.originCity || ''} (${charge.originPincode})`,
      'Destination': `${charge.destinationCity || ''} (${charge.destinationPincode})`,
      'Booked Weight': charge.bookedWeight,
      'Volumetric Weight': charge.volWeight || '',
      'Freight Charge': charge.freightCharge.toFixed(2),
      'COD Charge': charge.codCharge.toFixed(2),
      'Before Discount': charge.amountBeforeDiscount.toFixed(2),
      'Discount': charge.discount.toFixed(2),
      'After Discount': charge.amountAfterDiscount.toFixed(2),
      'Status': charge.status
    }));
    
    // Generate export file
    let exportResult;
    if (format.toLowerCase() === 'xlsx') {
      exportResult = await generateXLSX(exportData, 'shipping_charges');
    } else {
      exportResult = await generateCSV(exportData, 'shipping_charges');
    }
    
    // Set response headers and send file
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    res.status(200).send(exportResult.content);
  } catch (error) {
    logger.error(`Error in exportShippingCharges: ${error.message}`);
    next(new AppError(error.message, 500));
  }
}; 