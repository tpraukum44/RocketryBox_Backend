import bwipjs from 'bwip-js';
import fs from 'fs';
import mongoose from 'mongoose';
import path from 'path';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import { AppError } from '../../../middleware/errorHandler.js';
import { OrderBookingService } from '../../../services/orderBooking.service.js';
import rateCardService from '../../../services/ratecard.service.js';
import shippingPartnerServiceabilityService from '../../../services/shippingPartnerServiceability.service.js';
import { sendEmail } from '../../../utils/email.js';
import { emitEvent, EVENT_TYPES } from '../../../utils/eventEmitter.js';
import { logger } from '../../../utils/logger.js';
import { createPaymentOrder, getPaymentStatus, verifyPayment } from '../../../utils/payment.js';
import { sendSMS, SMS_TEMPLATES } from '../../../utils/sms.js';
import Customer from '../models/customer.model.js';
import CustomerOrder from '../models/customerOrder.model.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper function to convert SVG logo to PNG buffer for PDF use
const getLogoBuffer = async () => {
  try {
    // Use the correct path that actually works (tested and confirmed)
    // From controller location: go up 5 levels to project root, then down to logo
    let logoPath = path.join(__dirname, '..', '..', '..', '..', '..', 'frontend', 'public', 'icons', 'logo.svg');

    console.log('🎨 Looking for RocketryBox logo at:', logoPath);
    console.log('📂 Controller __dirname:', __dirname);

    if (!fs.existsSync(logoPath)) {
      console.log('❌ Logo file not found at primary path:', logoPath);

      // Try alternative known working path
      const alternativePath = path.join(__dirname, '..', '..', '..', '..', '..', 'frontend', 'public', 'icons', 'logo.svg');
      console.log('🔍 Trying alternative path:', alternativePath, 'exists:', fs.existsSync(alternativePath));

      if (fs.existsSync(alternativePath)) {
        console.log('✅ Using alternative path');
        logoPath = alternativePath;
      } else {
        console.log('❌ Logo not found in any expected location');
        return null;
      }
    }

    // Read SVG file
    const svgBuffer = fs.readFileSync(logoPath);
    console.log('📄 RocketryBox SVG loaded successfully, size:', svgBuffer.length, 'bytes');

    // Check if SVG content looks valid
    const svgContent = svgBuffer.toString('utf8').substring(0, 100);
    console.log('📄 SVG content preview:', svgContent);

    // Convert SVG to PNG using sharp
    console.log('🔄 Converting RocketryBox logo to PNG...');
    const pngBuffer = await sharp(svgBuffer)
      .png({
        quality: 95, // High quality for logo
        compressionLevel: 6
      })
      .resize(140, 50, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 } // White background
      })
      .toBuffer();

    console.log('✅ RocketryBox logo converted successfully, PNG size:', pngBuffer.length, 'bytes');

    // Verify the PNG buffer is valid
    if (pngBuffer && pngBuffer.length > 0) {
      console.log('✅ PNG buffer is ready for PDF insertion');
      return pngBuffer;
    } else {
      console.log('❌ PNG buffer is invalid');
      return null;
    }

  } catch (error) {
    console.error('❌ RocketryBox logo processing failed:', error.message);
    console.error('🔍 Error details:', error.name, error.code);
    return null;
  }
};

// Environment check for development features
const isDevelopment = true; // Force to true since PDF generation works correctly
// console.log('🔍 DEBUG: isDevelopment result:', isDevelopment);

// Utility function to format monetary values to 2 decimal places
const formatMoney = (amount) => {
  return Math.round(amount * 100) / 100;
};

// Create new order
/**
 * Get order by ID
 */
export const getOrderById = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user.id;

    const order = await CustomerOrder.findOne({
      _id: orderId,
      customerId: customerId
    }).populate('paymentId');

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Transform order data to match frontend expectations
    const transformedOrder = {
      _id: order._id,
      orderNumber: order.orderNumber || 'N/A',

      // Flattened structure for payment page compatibility
      receiverName: order.deliveryAddress?.name || 'N/A',
      receiverAddress1: order.deliveryAddress?.address?.line1 || 'N/A',
      receiverAddress2: order.deliveryAddress?.address?.line2 || '',
      receiverCity: order.deliveryAddress?.address?.city || 'N/A',
      receiverState: order.deliveryAddress?.address?.state || 'N/A',
      receiverPincode: order.deliveryAddress?.address?.pincode || 'N/A',
      receiverMobile: order.deliveryAddress?.phone || 'N/A',
      weight: order.packageDetails?.weight || 0,
      length: order.packageDetails?.dimensions?.length || 10,
      width: order.packageDetails?.dimensions?.width || 10,
      height: order.packageDetails?.dimensions?.height || 10,
      packageType: order.selectedProvider?.serviceType || 'standard',
      pickupDate: order.createdAt,

      // Nested structure for OrderDetails page
      packageDetails: {
        weight: order.packageDetails?.weight || 0,
        dimensions: {
          length: order.packageDetails?.dimensions?.length || 10,
          width: order.packageDetails?.dimensions?.width || 10,
          height: order.packageDetails?.dimensions?.height || 10
        },
        declaredValue: order.packageDetails?.declaredValue || 0
      },
      pickupAddress: {
        name: order.pickupAddress?.name || 'N/A',
        phone: order.pickupAddress?.phone || 'N/A',
        address: {
          line1: order.pickupAddress?.address?.line1 || 'N/A',
          line2: order.pickupAddress?.address?.line2 || '',
          city: order.pickupAddress?.address?.city || 'N/A',
          state: order.pickupAddress?.address?.state || 'N/A',
          pincode: order.pickupAddress?.address?.pincode || 'N/A',
          country: order.pickupAddress?.address?.country || 'India'
        }
      },
      deliveryAddress: {
        name: order.deliveryAddress?.name || 'N/A',
        phone: order.deliveryAddress?.phone || 'N/A',
        address: {
          line1: order.deliveryAddress?.address?.line1 || 'N/A',
          line2: order.deliveryAddress?.address?.line2 || '',
          city: order.deliveryAddress?.address?.city || 'N/A',
          state: order.deliveryAddress?.address?.state || 'N/A',
          pincode: order.deliveryAddress?.address?.pincode || 'N/A',
          country: order.deliveryAddress?.address?.country || 'India'
        }
      },
      selectedProvider: {
        name: order.selectedProvider?.name || 'Generic Courier',
        serviceType: order.selectedProvider?.serviceType || 'standard',
        estimatedDays: order.selectedProvider?.estimatedDays || '3-5',
        totalRate: parseFloat(order.selectedProvider?.totalRate) || 0
      },

      // Payment and shipping info
      shippingPartner: {
        name: order.selectedProvider?.name || 'Generic Courier',
        rate: parseFloat(order.shippingRate) || 0
      },
      shippingRate: parseFloat(order.shippingRate) || 0,
      status: order.status || 'pending',
      paymentStatus: order.paymentStatus || 'pending',
      totalAmount: parseFloat(order.totalAmount) || 0,

      // AWB handling - show actual AWB or clear indication it's pending
      awb: order.awb || null,
      awbStatus: order.awb ? 'Generated' : 'Pending',
      displayAwb: order.awb || 'AWB Generation Pending',
      trackingUrl: order.trackingUrl || null,

      createdAt: order.createdAt
    };

    console.log('Transformed order data:', {
      orderId: order._id,
      orderNumber: transformedOrder.orderNumber,
      shippingPartner: transformedOrder.shippingPartner,
      totalAmount: transformedOrder.totalAmount,
      packageDetails: {
        weight: transformedOrder.weight,
        dimensions: {
          length: transformedOrder.length,
          width: transformedOrder.width,
          height: transformedOrder.height
        },
        declaredValue: transformedOrder.declaredValue
      },
      addresses: {
        pickup: !!order.pickupAddress,
        delivery: !!order.deliveryAddress
      },
      rawData: {
        hasPackageDetails: !!order.packageDetails,
        hasSelectedProvider: !!order.selectedProvider,
        shippingRateRaw: order.shippingRate,
        totalAmountRaw: order.totalAmount
      }
    });

    res.status(200).json({
      success: true,
      data: transformedOrder
    });
  } catch (error) {
    logger.error('Error fetching order:', error);
    next(new AppError('Failed to fetch order details', 500));
  }
};

/**
 * Get order history for customer
 */
export const getOrderHistory = async (req, res, next) => {
  try {
    const customerId = req.user.id;
    const { page = 1, limit = 10, status } = req.query;

    // Debug logging
    console.log('🔍 getOrderHistory called with:', {
      customerId: customerId,
      customerIdType: typeof customerId,
      userObject: {
        id: req.user.id,
        email: req.user.email,
        name: req.user.name
      },
      queryParams: { page, limit, status }
    });

    // Convert string customerId to ObjectId for proper matching
    const customerObjId = mongoose.Types.ObjectId.createFromHexString(customerId);

    const filter = { customerId: customerObjId };
    if (status && status !== 'All' && status !== 'undefined' && status !== 'null') {
      // Map frontend status to backend status
      const statusMapping = {
        'Booked': 'confirmed',
        'Processing': 'pending',
        'In Transit': 'shipped',
        'Out for Delivery': 'shipped', // Map to shipped for now
        'Delivered': 'delivered',
        'Cancelled': 'cancelled'
      };
      filter.status = statusMapping[status] || status.toLowerCase();
    }

    console.log('🔍 MongoDB filter:', filter);

    const orders = await CustomerOrder.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await CustomerOrder.countDocuments(filter);

    console.log('🔍 Query results:', {
      ordersFound: orders.length,
      totalCount: total
    });

    // Transform orders to match frontend expected format
    const transformedOrders = orders.map(order => {
      // Map backend status to frontend status
      const statusMapping = {
        'pending': 'Processing',
        'confirmed': 'Booked',
        'shipped': 'In Transit',
        'delivered': 'Delivered',
        'cancelled': 'Cancelled'
      };

      // Handle AWB display properly
      const awbDisplay = order.awb ? order.awb : 'AWB Pending';
      const hasRealAwb = order.awb && !order.awb.startsWith('TEMP') && !order.awb.startsWith('MB') && !order.awb.startsWith('XB') && !order.awb.startsWith('EC');

      return {
        date: order.createdAt.toISOString().split('T')[0], // Format as YYYY-MM-DD
        awb: awbDisplay, // Show AWB or "AWB Pending"
        orderNumber: order.orderNumber, // Include order number separately
        consigne: order.deliveryAddress?.name || 'N/A',
        product: order.packageDetails?.weight ? `${order.packageDetails.weight}kg Package` : 'Package',
        courier: order.courierPartner || order.selectedProvider?.name || 'RocketryBox',
        amount: order.totalAmount || 0,
        label: order.trackingUrl || '#',
        status: statusMapping[order.status] || order.status,
        edd: order.estimatedDelivery
          ? order.estimatedDelivery.toISOString().split('T')[0]
          : 'TBD',
        pdfUrl: order.trackingUrl || '#',
        // Include tracking status
        trackingStatus: hasRealAwb ? 'Available' : 'Pending',
        // Include original order data for details page
        _id: order._id,
        paymentStatus: order.paymentStatus,
        // For frontend display clarity
        displayAwb: hasRealAwb ? order.awb : null,
        displayOrderNumber: order.orderNumber,
        isAwbGenerated: hasRealAwb
      };
    });

    res.status(200).json({
      success: true,
      data: {
        orders: transformedOrders,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    logger.error('Error fetching order history:', error);
    next(new AppError('Failed to fetch order history', 500));
  }
};

export const createOrder = async (req, res, next) => {
  try {
    console.log('CreateOrder - Request body:', JSON.stringify(req.body, null, 2));
    console.log('CreateOrder - User:', req.user);

    const {
      pickupAddress,
      deliveryAddress,
      package: packageDetails,
      selectedProvider,
      serviceType,
      paymentMethod,
      instructions,
      pickupDate
    } = req.body;

    // Add validation for required fields
    if (!pickupAddress || !pickupAddress.pincode) {
      return next(new AppError('Pickup address with pincode is required', 400));
    }

    if (!deliveryAddress || !deliveryAddress.pincode) {
      return next(new AppError('Delivery address with pincode is required', 400));
    }

    if (!packageDetails || !packageDetails.weight) {
      return next(new AppError('Package details with weight is required', 400));
    }

    console.log('Pickup pincode:', pickupAddress.pincode);
    console.log('Delivery pincode:', deliveryAddress.pincode);
    console.log('Selected provider:', selectedProvider);

    let selectedRate;
    let totalRate;

    if (selectedProvider) {
      // Use the provider selected by the user
      selectedRate = {
        id: selectedProvider.id,
        courier: selectedProvider.name,
        provider: { name: selectedProvider.name, estimatedDays: selectedProvider.estimatedDays },
        totalRate: selectedProvider.totalRate,
        estimatedDelivery: selectedProvider.estimatedDays
      };
      totalRate = selectedProvider.totalRate;
      console.log('Using user-selected provider:', selectedProvider.name);
    } else {
      // Calculate shipping rates if no provider selected using unified service
      const rateResult = await rateCardService.calculateShippingRate({
        fromPincode: pickupAddress.pincode,
        toPincode: deliveryAddress.pincode,
        weight: packageDetails.weight,
        dimensions: packageDetails.dimensions || { length: 10, width: 10, height: 10 },
        mode: serviceType === 'express' ? 'Air' : 'Surface',
        orderType: serviceType === 'cod' ? 'cod' : 'prepaid',
        codCollectableAmount: packageDetails.declaredValue || 0,
        includeRTO: false
      });

      if (!rateResult.success || !rateResult.calculations.length) {
        return next(new AppError('No shipping rates available for the given parameters', 400));
      }

      // Use the cheapest rate for order creation
      const cheapestRate = rateResult.calculations[0];
      selectedRate = {
        id: cheapestRate.rateCardId,
        courier: cheapestRate.courier,
        provider: {
          name: cheapestRate.courier,
          estimatedDays: rateResult.deliveryEstimate
        },
        totalRate: cheapestRate.total,
        estimatedDelivery: rateResult.deliveryEstimate
      };
      totalRate = cheapestRate.total;
      console.log('Using calculated rate from unified service:', selectedRate);
    }

    // Calculate estimated delivery date (add 3-5 days to current date)
    const estimatedDeliveryDays = 3; // Default to 3 days
    const estimatedDeliveryDate = new Date();
    estimatedDeliveryDate.setDate(estimatedDeliveryDate.getDate() + estimatedDeliveryDays);

    // Ensure package has items array (required by schema)
    const packageData = {
      ...packageDetails,
      items: packageDetails.items || [
        {
          name: 'Package Item',
          quantity: 1,
          value: packageDetails.declaredValue || 100
        }
      ]
    };

    // Create order data matching CustomerOrder model structure
    const orderData = {
      customerId: req.user.id,
      packageDetails: {
        weight: packageDetails.weight,
        dimensions: packageDetails.dimensions || { length: 10, width: 10, height: 10 },
        declaredValue: packageDetails.declaredValue || 100
      },
      pickupAddress: {
        name: pickupAddress.name,
        phone: pickupAddress.phone,
        email: pickupAddress.email,
        address: {
          line1: pickupAddress.address1 || pickupAddress.line1,
          line2: pickupAddress.address2 || pickupAddress.line2,
          city: pickupAddress.city,
          state: pickupAddress.state,
          pincode: pickupAddress.pincode,
          country: pickupAddress.country || 'India'
        }
      },
      deliveryAddress: {
        name: deliveryAddress.name,
        phone: deliveryAddress.phone,
        email: deliveryAddress.email,
        address: {
          line1: deliveryAddress.address1 || deliveryAddress.line1,
          line2: deliveryAddress.address2 || deliveryAddress.line2,
          city: deliveryAddress.city,
          state: deliveryAddress.state,
          pincode: deliveryAddress.pincode,
          country: deliveryAddress.country || 'India'
        }
      },
      selectedProvider: {
        id: selectedRate.id || 'generic',
        name: selectedRate.provider?.name || selectedRate.courier || 'Generic Courier',
        serviceType: serviceType,
        totalRate: formatMoney(totalRate),
        estimatedDays: selectedRate.provider?.estimatedDays || selectedRate.estimatedDelivery || '3-5'
      },
      shippingRate: formatMoney(totalRate),
      totalAmount: formatMoney(totalRate), // Only shipping charges for prepaid B2C orders
      instructions: instructions || '',
      pickupDate: pickupDate ? new Date(pickupDate) : new Date()
    };

    console.log('Creating order with data:', JSON.stringify(orderData, null, 2));

    const order = await CustomerOrder.create(orderData);

    console.log('Order created successfully:', {
      id: order._id,
      awb: order.awb,
      status: order.status
    });

    // Emit order created event for real-time dashboard updates
    try {
      emitEvent(EVENT_TYPES.ORDER_CREATED, {
        orderId: order._id,
        orderNumber: order.orderNumber,
        awb: order.awb,
        customerId: req.user.id,
        totalAmount: order.totalAmount,
        status: order.status
      });
    } catch (eventError) {
      console.error('Error emitting event:', eventError);
      // Don't fail the request if event emission fails
    }

    // Send order confirmation (but don't fail if notifications fail)
    try {
      const customer = await Customer.findById(req.user.id);
      if (customer && customer.preferences && customer.preferences.notifications) {
        if (customer.preferences.notifications.email) {
          await sendEmail({
            to: customer.email,
            subject: 'Order Confirmation - RocketryBox',
            text: `Your order has been created successfully. Order Number: ${order.orderNumber}`
          });
        }

        if (customer.preferences.notifications.sms) {
          await sendSMS({
            to: customer.phone,
            templateId: SMS_TEMPLATES.TRACKING_UPDATE.templateId,
            variables: {
              trackingId: order.orderNumber,
              status: 'Pending',
              location: pickupAddress.city
            }
          });
        }
      }
    } catch (notificationError) {
      console.error('Error sending notifications:', notificationError);
      // Don't fail the request if notifications fail
    }

    res.status(201).json({
      success: true,
      data: {
        message: 'Order created successfully',
        order: {
          id: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          paymentStatus: order.paymentStatus,
          totalAmount: formatMoney(order.totalAmount),
          shippingRate: formatMoney(order.shippingRate),
          awb: order.awb,
          createdAt: order.createdAt
        }
      }
    });
  } catch (error) {
    console.error('CreateOrder error:', error);
    next(new AppError(error.message, 400));
  }
};

// List orders
export const listOrders = async (req, res, next) => {
  try {
    const {
      page = 1,
      limit = 10,
      query,
      sortField = 'createdAt',
      sortDirection = 'desc',
      status,
      startDate,
      endDate
    } = req.query;

    // Build query
    const filter = { customerId: req.user.id };
    if (status) filter.status = status;
    if (startDate && endDate) {
      filter.createdAt = {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      };
    }
    if (query) {
      filter.$or = [
        { awb: { $regex: query, $options: 'i' } },
        { 'pickupAddress.city': { $regex: query, $options: 'i' } },
        { 'deliveryAddress.city': { $regex: query, $options: 'i' } }
      ];
    }

    // Execute query
    const orders = await CustomerOrder.find(filter)
      .sort({ [sortField]: sortDirection === 'desc' ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await CustomerOrder.countDocuments(filter);

    res.status(200).json({
      success: true,
      data: {
        orders,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Get order details
export const getOrderDetails = async (req, res, next) => {
  try {
    const { awb } = req.params;
    const customerId = req.user.id;

    console.log('🔍 getOrderDetails called with:');
    console.log('  AWB:', awb);
    console.log('  Customer ID:', customerId);
    console.log('  Customer ID type:', typeof customerId);

    const order = await CustomerOrder.findOne({
      awb,
      customerId: req.user.id
    });

    console.log('🔍 Database query result:');
    console.log('  Order found:', !!order);

    if (!order) {
      console.log('❌ Order not found with AWB:', awb, 'and Customer ID:', customerId);

      // Let's check if the order exists with a different customer ID or AWB
      const orderByAwb = await CustomerOrder.findOne({ awb });
      const orderByCustomer = await CustomerOrder.findOne({ customerId });

      console.log('  Order exists with AWB (any customer):', !!orderByAwb);
      console.log('  Any order exists for customer:', !!orderByCustomer);

      if (orderByAwb) {
        console.log('  AWB order customer ID:', orderByAwb.customerId);
      }

      return next(new AppError('Order not found', 404));
    }

    console.log('✅ Order found:', order.orderNumber);
    console.log('  Package details present:', !!order.packageDetails);
    console.log('  Pickup address present:', !!order.pickupAddress);
    console.log('  Delivery address present:', !!order.deliveryAddress);

    // Transform order data to match frontend OrderDetails.tsx expectations
    const orderData = {
      _id: order._id,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      totalAmount: parseFloat(order.totalAmount) || 0,
      shippingRate: parseFloat(order.shippingRate) || 0,
      packageDetails: {
        weight: order.packageDetails?.weight || 0,
        dimensions: {
          length: order.packageDetails?.dimensions?.length || 10,
          width: order.packageDetails?.dimensions?.width || 10,
          height: order.packageDetails?.dimensions?.height || 10
        },
        declaredValue: order.packageDetails?.declaredValue || 0
      },
      pickupAddress: {
        name: order.pickupAddress?.name || 'N/A',
        phone: order.pickupAddress?.phone || 'N/A',
        address: {
          line1: order.pickupAddress?.address?.line1 || 'N/A',
          line2: order.pickupAddress?.address?.line2 || '',
          city: order.pickupAddress?.address?.city || 'N/A',
          state: order.pickupAddress?.address?.state || 'N/A',
          pincode: order.pickupAddress?.address?.pincode || 'N/A'
        }
      },
      deliveryAddress: {
        name: order.deliveryAddress?.name || 'N/A',
        phone: order.deliveryAddress?.phone || 'N/A',
        address: {
          line1: order.deliveryAddress?.address?.line1 || 'N/A',
          line2: order.deliveryAddress?.address?.line2 || '',
          city: order.deliveryAddress?.address?.city || 'N/A',
          state: order.deliveryAddress?.address?.state || 'N/A',
          pincode: order.deliveryAddress?.address?.pincode || 'N/A'
        }
      },
      selectedProvider: {
        name: order.selectedProvider?.name || 'N/A',
        serviceType: order.selectedProvider?.serviceType || 'standard',
        estimatedDays: order.selectedProvider?.estimatedDays || '3-5',
        totalRate: parseFloat(order.selectedProvider?.totalRate) || 0
      },

      // AWB and tracking information
      awb: order.awb || null,
      awbStatus: order.awb ? 'Generated' : 'Pending Generation',
      displayAwb: order.awb || 'AWB will be generated after courier booking',
      trackingUrl: order.trackingUrl || null,
      trackingAvailable: !!(order.awb && order.trackingUrl),

      createdAt: order.createdAt
    };

    console.log('📤 Sending response:');
    console.log('  Order Number:', orderData.orderNumber);
    console.log('  Weight:', orderData.packageDetails.weight);
    console.log('  Pickup Name:', orderData.pickupAddress.name);
    console.log('  Provider Name:', orderData.selectedProvider.name);
    console.log('  AWB:', orderData.awb);
    console.log('  Tracking URL:', orderData.trackingUrl);

    res.status(200).json({
      success: true,
      data: orderData
    });
  } catch (error) {
    console.error('❌ Error in getOrderDetails:', error);
    next(new AppError(error.message, 400));
  }
};

// Download order label
export const downloadLabel = async (req, res, next) => {
  console.log('========== DOWNLOAD LABEL START ==========');
  console.log('Request URL:', req.originalUrl);
  console.log('Request method:', req.method);
  console.log('Request params:', req.params);
  console.log('Request headers:', {
    'content-type': req.headers['content-type'],
    'authorization': req.headers.authorization ? 'Bearer ***' : 'No auth header',
    'user-agent': req.headers['user-agent']
  });
  console.log('Request user:', req.user ? { id: req.user.id, email: req.user.email } : 'No user');

  try {
    const { awb } = req.params;

    console.log('DownloadLabel - AWB:', awb);
    console.log('DownloadLabel - Customer ID:', req.user.id);

    const order = await CustomerOrder.findOne({
      awb,
      customerId: req.user.id
    }).select('+label');

    if (!order) {
      console.log('DownloadLabel - Order not found for AWB:', awb, 'Customer:', req.user.id);
      return next(new AppError('Order not found. Please check your AWB number.', 404));
    }

    console.log('DownloadLabel - Order found:', order.orderNumber);
    console.log('DownloadLabel - Order status:', order.status);
    console.log('DownloadLabel - Has label:', !!order.label);

    if (order.label) {
      // Check if cached label is corrupted (wrong base64 length)
      try {
        // TEMPORARY FIX: Force regeneration of all labels to clear corruption
        console.log('DownloadLabel - Forcing regeneration of all labels (temporary fix)');
        order.label = null;
        await order.save();

        // After clearing, fall through to regeneration
      } catch (error) {
        console.log('DownloadLabel - Cached label invalid, clearing...');
        order.label = null;
        await order.save();
      }
    }

    // Generate new label (either no cache or corrupted cache was cleared)
    if (!order.label) {
      console.log('DownloadLabel - No cached label, generating new PDF...');
      console.log('DownloadLabel - Environment NODE_ENV:', process.env.NODE_ENV);
      console.log('DownloadLabel - isDevelopment:', isDevelopment);

      // Always generate PDF since PDFKit is working correctly
      console.log('DownloadLabel - Generating PDF with PDFKit...');
      console.log('DownloadLabel - Order data debug:', {
        orderNumber: order.orderNumber,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        packageDetails: order.packageDetails,
        selectedProvider: order.selectedProvider,
        shippingRate: order.shippingRate,
        status: order.status
      });

      try {
        // Create PDF using PDFKit (standard shipping label format)
        const doc = new PDFDocument({
          size: [400, 600], // Standard shipping label size (portrait)
          margin: 15
        });

        // Collect PDF data in memory
        const chunks = [];
        doc.on('data', chunk => chunks.push(chunk));

        // Create a promise that resolves when PDF is complete
        const pdfPromise = new Promise((resolve, reject) => {
          doc.on('end', () => {
            const pdfBuffer = Buffer.concat(chunks);
            resolve(pdfBuffer);
          });
          doc.on('error', reject);
        });

        // Build the PDF content - STANDARD SHIPPING LABEL FORMAT
        let currentY = 20;

        // Border around entire label
        doc.rect(10, 10, 380, 580).stroke();

        // Logo section with enhanced positioning and prominence
        const logoBuffer = await getLogoBuffer();
        if (logoBuffer) {
          // Use actual RocketryBox logo - centered and prominent with better positioning
          console.log('🎨 Inserting RocketryBox logo into PDF');

          // Add a subtle border around logo area for professional look
          doc.rect(125, currentY - 5, 150, 60).stroke();

          // Insert the logo centered within the border
          doc.image(logoBuffer, 130, currentY, { width: 140, height: 50 });
        } else {
          // Enhanced fallback logo with better styling
          console.log('📝 Using enhanced fallback logo design');

          // Create a professional styled text logo
          doc.rect(125, currentY - 5, 150, 60).stroke();
          doc.rect(130, currentY, 140, 50).fill('#1e3a8a'); // Professional blue

          doc.fillColor('white').fontSize(16).font('Helvetica-Bold');
          doc.text('ROCKETRY', 135, currentY + 12, { width: 130, align: 'center' });
          doc.fillColor('#f97316').fontSize(16).font('Helvetica-Bold'); // Orange for BOX
          doc.text('BOX', 135, currentY + 28, { width: 130, align: 'center' });

          doc.fillColor('black'); // Reset color for rest of PDF
        }
        currentY += 70;

        // Service name
        doc.fillColor('black').fontSize(14).font('Helvetica-Bold');
        doc.text('ROCKETRYBOX EXPRESS SERVICE', 20, currentY, { align: 'center', width: 360 });
        currentY += 20;

        // Tracking number
        doc.fontSize(12).font('Helvetica');
        doc.text(`Tracking # ${awb}`, 20, currentY, { align: 'center', width: 360 });
        currentY += 25;

        // Weight and package info
        const weight = order.packageDetails?.weight || 'N/A';
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text(`${weight} KGS     1 of 1`, 20, currentY, { align: 'center', width: 360 });
        currentY += 30;

        // Large barcode section
        doc.rect(20, currentY, 360, 60).stroke();

        try {
          // Generate proper Code 128 barcode
          const barcodeBuffer = await bwipjs.toBuffer({
            bcid: 'code128',       // Barcode type (Code 128 is standard for shipping)
            text: awb,             // AWB number to encode
            scale: 2,              // Scaling factor
            height: 8,             // Height in millimeters
            includetext: false,    // Don't include text in barcode image
            textxalign: 'center',  // Center align text
            backgroundcolor: 'ffffff', // White background
            color: '000000'        // Black bars
          });

          // Insert barcode image into PDF
          doc.image(barcodeBuffer, 30, currentY + 5, { width: 300, height: 25 });

        } catch (barcodeError) {
          console.log('Barcode generation failed, using fallback pattern:', barcodeError);
          // Fallback to text pattern if barcode generation fails
          let barcodePattern = '';
          for (let i = 0; i < Math.min(awb.length, 8); i++) {
            const char = awb.charCodeAt(i);
            if (char % 4 === 0) barcodePattern += '|||  |  ';
            else if (char % 4 === 1) barcodePattern += '|  |||  ';
            else if (char % 4 === 2) barcodePattern += '||  |  |';
            else barcodePattern += '|  ||  |';
          }
          barcodePattern = barcodePattern.substring(0, 45);
          doc.fontSize(14).font('Courier-Bold');
          doc.text(barcodePattern, 30, currentY + 8, { width: 320 });
        }

        // AWB number clearly below barcode with proper spacing
        doc.fontSize(12).font('Helvetica-Bold');
        doc.text(awb, 30, currentY + 35);

        // Website in bottom right
        doc.fontSize(8).font('Helvetica');
        doc.text('www.rocketrybox.com', 250, currentY + 48);
        currentY += 80;

        // Ship From section
        doc.rect(20, currentY, 360, 90).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Ship From:', 25, currentY + 5);

        doc.fontSize(9).font('Helvetica');
        let fromY = currentY + 20;

        // From address - properly formatted
        const fromName = order.pickupAddress?.name || 'Sender Name';
        doc.text(fromName, 25, fromY);

        const fromAddr1 = order.pickupAddress?.address?.line1 || 'Address Line 1';
        doc.text(fromAddr1, 25, fromY + 12, { width: 350 });

        let nextFromY = fromY + 24;
        if (order.pickupAddress?.address?.line2) {
          doc.text(order.pickupAddress.address.line2, 25, nextFromY, { width: 350 });
          nextFromY += 12;
        }

        const fromCityState = `${order.pickupAddress?.address?.city || 'City'}, ${order.pickupAddress?.address?.state || 'State'}, ${order.pickupAddress?.address?.pincode || 'XXXXXX'}`;
        doc.text(fromCityState, 25, nextFromY);

        const fromCountry = order.pickupAddress?.address?.country || 'India';
        doc.text(fromCountry, 25, nextFromY + 12);

        const fromPhone = order.pickupAddress?.phone || 'Phone Number';
        doc.text(fromPhone, 25, nextFromY + 24);

        currentY += 110;

        // Ship To section
        doc.rect(20, currentY, 360, 90).stroke();
        doc.fontSize(10).font('Helvetica-Bold');
        doc.text('Ship To:', 25, currentY + 5);

        doc.fontSize(9).font('Helvetica');
        let toY = currentY + 20;

        // To address - properly formatted
        const toName = order.deliveryAddress?.name || 'CUSTOMER NAME';
        doc.text(toName.toUpperCase(), 25, toY);

        const toAddr1 = order.deliveryAddress?.address?.line1 || 'Customer Address';
        doc.text(toAddr1, 25, toY + 12, { width: 350 });

        let nextToY = toY + 24;
        if (order.deliveryAddress?.address?.line2) {
          doc.text(order.deliveryAddress.address.line2, 25, nextToY, { width: 350 });
          nextToY += 12;
        }

        const toCityState = `${order.deliveryAddress?.address?.city || 'City'}, ${order.deliveryAddress?.address?.state || 'State'}, ${order.deliveryAddress?.address?.pincode || 'XXXXXX'}`;
        doc.text(toCityState, 25, nextToY);

        const toCountry = order.deliveryAddress?.address?.country || 'India';
        doc.text(toCountry, 25, nextToY + 12);

        const toPhone = order.deliveryAddress?.phone || 'Customer Phone';
        doc.text(toPhone, 25, nextToY + 24);

        currentY += 110;

        // Order details section
        doc.rect(20, currentY, 360, 40).stroke();
        doc.fontSize(8).font('Helvetica');
        doc.text(`Order: ${order.orderNumber} | Date: ${new Date(order.createdAt).toLocaleDateString('en-IN')} | Service: ${order.selectedProvider?.serviceType || 'Standard'}`, 25, currentY + 5, { width: 350 });
        doc.text(`Declared Value: Rs. ${order.packageDetails?.declaredValue || 'N/A'} | Payment: ${order.paymentStatus || 'Pending'} | Amount: Rs. ${order.shippingRate || 'N/A'}`, 25, currentY + 15, { width: 350 });
        doc.text(`Courier: ${order.selectedProvider?.name || 'RocketryBox Express'} | Track: www.rocketrybox.com/track?awb=${awb}`, 25, currentY + 25, { width: 350 });

        // Instructions if any
        if (order.instructions) {
          currentY += 50;
          doc.rect(20, currentY, 360, 30).stroke();
          doc.fontSize(8).font('Helvetica-Bold');
          doc.text('Special Instructions:', 25, currentY + 5);
          doc.fontSize(7).font('Helvetica');
          doc.text(order.instructions, 25, currentY + 15, { width: 350, height: 10 });
        }

        // Finalize the PDF
        doc.end();

        // Wait for PDF to be complete
        const pdfBuffer = await pdfPromise;

        console.log('DownloadLabel - PDFKit generated successfully, size:', pdfBuffer.length, 'bytes');

        // Convert to base64 and cache
        const base64Label = pdfBuffer.toString('base64');
        order.label = base64Label;
        await order.save();

        console.log('DownloadLabel - PDF cached successfully');

        // Return PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=shipping-label-${awb}.pdf`);
        res.send(pdfBuffer);
        return;

      } catch (pdfError) {
        console.error('DownloadLabel - PDFKit generation error:', pdfError);

        // Fallback to simple HTML if PDF generation fails
        const simpleHTML = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <title>Shipping Label - ${awb}</title>
            <style>
              body { font-family: Arial; margin: 20px; }
              .header { background: #2c3e50; color: white; padding: 20px; text-align: center; }
              .logo { max-height: 40px; margin-bottom: 10px; }
              .content { padding: 20px; }
              .section { margin: 20px 0; padding: 15px; border: 1px solid #ddd; }
              .awb { font-size: 24px; font-weight: bold; color: #2c3e50; }
            </style>
          </head>
          <body>
            <div class="header">
              <div style="font-size: 18px; font-weight: bold;">ROCKETRYBOX</div>
              <div style="font-size: 14px;">Shipping Label</div>
            </div>
            <div class="content">
              <div class="section">
                <div class="awb">AWB: ${awb}</div>
                <p>Order: ${order.orderNumber}</p>
                <p>Date: ${new Date(order.createdAt).toLocaleDateString()}</p>
              </div>
              <div class="section">
                <h3>From:</h3>
                <p>${order.pickupAddress?.name || 'N/A'}<br>
                ${order.pickupAddress?.address?.city || 'N/A'}, ${order.pickupAddress?.address?.state || 'N/A'}</p>
              </div>
              <div class="section">
                <h3>To:</h3>
                <p>${order.deliveryAddress?.name || 'N/A'}<br>
                ${order.deliveryAddress?.address?.city || 'N/A'}, ${order.deliveryAddress?.address?.state || 'N/A'}</p>
              </div>
              <div class="section">
                <p>Weight: ${order.packageDetails?.weight || 'N/A'} kg</p>
                <p>Service: ${order.selectedProvider?.name || 'RocketryBox'}</p>
                <p>Amount: ₹${order.shippingRate || 'N/A'}</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const htmlBuffer = Buffer.from(simpleHTML, 'utf8');
        res.setHeader('Content-Type', 'text/html');
        res.setHeader('Content-Disposition', `attachment; filename=shipping-label-${awb}.html`);
        res.send(htmlBuffer);
        return;
      }
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=label-${awb}.pdf`);
    res.send(Buffer.from(order.label, 'base64'));
  } catch (error) {
    console.error('DownloadLabel error:', error);
    console.error('DownloadLabel error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name,
      code: error.code
    });
    next(new AppError(`Failed to download label: ${error.message}`, 400));
  }
};

// Create payment order
export const createPayment = async (req, res, next) => {
  try {
    const { amount, currency, awbNumber, paymentMethod } = req.body;

    const order = await CustomerOrder.findOne({
      awb: awbNumber,
      customerId: req.user.id
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.status !== 'Booked') {
      return next(new AppError('Order cannot be paid', 400));
    }

    const paymentOrder = await createPaymentOrder({
      amount,
      currency,
      awbNumber,
      paymentMethod
    });

    res.status(200).json({
      success: true,
      data: paymentOrder
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Verify payment
export const verifyOrderPayment = async (req, res, next) => {
  try {
    const {
      awbNumber,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    } = req.body;

    const order = await CustomerOrder.findOne({
      awb: awbNumber,
      customerId: req.user.id
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    const payment = await verifyPayment({
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature
    });

    if (payment.success) {
      order.status = 'Processing';
      await order.save();

      // Send payment confirmation
      const customer = await Customer.findById(req.user.id);
      if (customer.preferences.notifications.email) {
        await sendEmail({
          to: customer.email,
          subject: 'Payment Confirmation - RocketryBox',
          text: `Payment successful for order ${order.awb}. Amount: ${order.amount}`
        });
      }

      if (customer.preferences.notifications.sms) {
        await sendSMS({
          to: customer.phone,
          templateId: SMS_TEMPLATES.TRACKING_UPDATE.templateId,
          variables: {
            trackingId: order.awb,
            status: 'Processing',
            location: order.pickupAddress.city
          }
        });
      }
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Payment verified successfully',
        payment
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Subscribe to tracking updates
export const subscribeTracking = async (req, res, next) => {
  try {
    const { awb } = req.params;
    const { channels, frequency } = req.body;

    const order = await CustomerOrder.findOne({
      awb,
      customerId: req.user.id
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Add tracking subscription
    order.tracking.subscription = {
      channels,
      frequency,
      status: 'active'
    };

    await order.save();

    res.status(200).json({
      success: true,
      data: {
        message: 'Tracking subscription successful',
        subscription: order.tracking.subscription
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Refund payment
export const refundPayment = async (req, res, next) => {
  try {
    const { awb } = req.params;
    const { amount, reason } = req.body;

    const order = await CustomerOrder.findOne({
      awb,
      customerId: req.user.id
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    if (order.status === 'Delivered') {
      return next(new AppError('Cannot refund a delivered order', 400));
    }

    const refund = await refundPayment({
      paymentId: order.paymentId,
      amount,
      notes: {
        reason,
        awb: order.awb
      }
    });

    if (!refund.success) {
      return next(new AppError(refund.error, 400));
    }

    // Update order status
    order.status = 'Cancelled';
    order.refund = {
      id: refund.data.refundId,
      amount: refund.data.amount,
      status: refund.data.status,
      createdAt: refund.data.createdAt
    };
    await order.save();

    // Send refund notification
    const customer = await Customer.findById(req.user.id);
    if (customer.preferences.notifications.email) {
      await sendEmail({
        to: customer.email,
        subject: 'Refund Processed - RocketryBox',
        text: `Refund of ${refund.data.amount} has been processed for order ${order.awb}.`
      });
    }

    if (customer.preferences.notifications.sms) {
      await sendSMS({
        to: customer.phone,
        templateId: SMS_TEMPLATES.REFUND_PROCESSED.templateId,
        variables: {
          amount: refund.data.amount,
          awb: order.awb
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        message: 'Refund processed successfully',
        refund: refund.data
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

// Check payment status
export const checkPaymentStatus = async (req, res, next) => {
  try {
    const { awb } = req.params;

    const order = await CustomerOrder.findOne({
      awb,
      customerId: req.user.id
    }).select('+paymentId');

    if (!order) {
      return res.status(200).json({
        success: true,
        data: {
          status: 'pending',
          message: 'Payment not initiated'
        }
      });
    }

    const payment = await getPaymentStatus(order.paymentId);

    res.status(200).json({
      success: true,
      data: {
        status: payment.status,
        amount: payment.amount,
        currency: payment.currency,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

export const calculateRates = async (req, res, next) => {
  try {
    const { weight, pickupPincode, deliveryPincode, serviceType } = req.body;

    // Add debugging
    console.log('🔍 calculateRates called with:', {
      weight,
      pickupPincode,
      deliveryPincode,
      serviceType,
      bodyKeys: Object.keys(req.body)
    });

    // Validate required fields
    if (!weight || !pickupPincode || !deliveryPincode || !serviceType) {
      console.log('❌ Validation failed - missing required fields');
      throw new AppError('Missing required fields: weight, pickupPincode, deliveryPincode, and serviceType are required', 400);
    }

    // Validate weight
    if (weight < 0.1) {
      console.log('❌ Weight validation failed:', weight);
      throw new AppError('Weight must be at least 0.1 kg', 400);
    }

    // Validate pincodes
    if (!/^\d{6}$/.test(pickupPincode) || !/^\d{6}$/.test(deliveryPincode)) {
      console.log('❌ Pincode validation failed:', { pickupPincode, deliveryPincode });
      throw new AppError('Invalid pincode format. Pincodes must be 6 digits', 400);
    }

    // Validate service type (only standard and express allowed for customers)
    if (!['standard', 'express', 'cod'].includes(serviceType)) {
      console.log('❌ Service type validation failed:', serviceType);
      throw new AppError('Invalid service type. Must be standard, express, or cod', 400);
    }

    console.log('✅ All validations passed, checking serviceability first...');

    // Step 1: Get unique couriers from rate cards to check serviceability
    const activeCouriersResult = await rateCardService.getActiveCouriers();
    if (!activeCouriersResult.success || !activeCouriersResult.couriers.length) {
      console.log('❌ No active couriers found in rate cards');
      throw new AppError('No shipping partners available', 404);
    }

    const activeCouriers = activeCouriersResult.couriers;
    console.log('📋 Active couriers found:', activeCouriers);

    // Step 2: Check serviceability for all active couriers in parallel
    console.log('🔄 Checking serviceability for all shipping partners...');
    const serviceabilityResult = await shippingPartnerServiceabilityService.checkMultipleCouriersServiceability(
      activeCouriers,
      pickupPincode,
      deliveryPincode,
      serviceType
    );

    if (!serviceabilityResult.success) {
      console.log('❌ Serviceability check failed:', serviceabilityResult.error);
      throw new AppError('Failed to check serviceability for shipping partners', 500);
    }

    console.log('📊 Serviceability check results:', {
      totalCouriers: serviceabilityResult.totalCouriers,
      serviceableCouriers: serviceabilityResult.serviceableCount,
      nonServiceableCouriers: serviceabilityResult.nonServiceableCount,
      checkTime: `${serviceabilityResult.checkTime}ms`
    });

    // Step 3: If no couriers are serviceable, return early with informative message
    if (serviceabilityResult.serviceableCount === 0) {
      console.log('❌ No serviceable couriers found for this route');

      // Log details of why each courier is not serviceable
      serviceabilityResult.nonServiceableCouriers.forEach(courier => {
        console.log(`  - ${courier.courier}: ${courier.reason}`);
      });

      return res.status(200).json({
        success: true,
        data: {
          rates: [],
          ratesByType: { standard: [], express: [] },
          zone: 'Unknown',
          chargeableWeight: weight,
          summary: {
            totalOptions: 0,
            standardOptions: 0,
            expressOptions: 0,
            cheapestRate: 0,
            cheapestStandard: 0,
            cheapestExpress: 0,
            fastestDelivery: 'N/A'
          },
          serviceabilityInfo: {
            totalPartnersChecked: serviceabilityResult.totalCouriers,
            serviceablePartners: 0,
            message: 'No shipping partners are serviceable for this pickup and delivery pincode combination',
            details: serviceabilityResult.nonServiceableCouriers.map(courier => ({
              partner: courier.courier,
              reason: courier.reason
            }))
          }
        }
      });
    }

    // Step 4: Get serviceable courier names for rate calculation filtering
    const serviceableCourierNames = serviceabilityResult.serviceableCouriers.map(courier => courier.courier);
    console.log('✅ Serviceable couriers:', serviceableCourierNames);

    // Step 5: Calculate rates for BOTH Surface and Air modes (existing logic)
    console.log('🔄 Calling rate service for Surface and Air modes...');

    const [surfaceResult, airResult] = await Promise.all([
      // Surface/Standard rates
      rateCardService.calculateShippingRate({
        fromPincode: pickupPincode,
        toPincode: deliveryPincode,
        weight,
        dimensions: { length: 10, width: 10, height: 10 }, // Default dimensions
        mode: 'Surface',
        orderType: serviceType === 'cod' ? 'cod' : 'prepaid',
        codCollectableAmount: 0,
        includeRTO: false
      }),
      // Air/Express rates
      rateCardService.calculateShippingRate({
        fromPincode: pickupPincode,
        toPincode: deliveryPincode,
        weight,
        dimensions: { length: 10, width: 10, height: 10 }, // Default dimensions
        mode: 'Air',
        orderType: serviceType === 'cod' ? 'cod' : 'prepaid',
        codCollectableAmount: 0,
        includeRTO: false
      })
    ]);

    console.log('📊 Rate service results:', {
      surfaceResult: {
        success: surfaceResult.success,
        error: surfaceResult.error,
        calculationsCount: surfaceResult.calculations?.length || 0,
        zone: surfaceResult.zone
      },
      airResult: {
        success: airResult.success,
        error: airResult.error,
        calculationsCount: airResult.calculations?.length || 0,
        zone: airResult.zone
      }
    });

    // Combine all calculations from both modes
    let allCalculations = [];
    let zone = 'Rest of India';
    let billedWeight = weight;
    let deliveryEstimate = '4-6 days';

    if (surfaceResult.success) {
      console.log('✅ Surface result successful, adding calculations...');
      allCalculations.push(...surfaceResult.calculations.map(calc => ({
        ...calc,
        serviceMode: 'Surface',
        serviceLabel: 'Standard'
      })));
      zone = surfaceResult.zone;
      billedWeight = surfaceResult.billedWeight;
      deliveryEstimate = surfaceResult.deliveryEstimate;
    } else {
      console.log('❌ Surface result failed:', surfaceResult.error);
    }

    if (airResult.success) {
      console.log('✅ Air result successful, adding calculations...');
      allCalculations.push(...airResult.calculations.map(calc => ({
        ...calc,
        serviceMode: 'Air',
        serviceLabel: 'Express'
      })));
      // Use faster delivery estimate for air if available
      if (airResult.deliveryEstimate && airResult.deliveryEstimate !== '4-6 days') {
        deliveryEstimate = airResult.deliveryEstimate;
      }
    } else {
      console.log('❌ Air result failed:', airResult.error);
    }

    console.log('📋 Total calculations before serviceability filtering:', allCalculations.length);

    // Step 6: Filter calculations to only include serviceable couriers
    const serviceableCalculations = shippingPartnerServiceabilityService.filterRatesByServiceability(
      allCalculations,
      serviceabilityResult.serviceableCouriers
    );

    console.log('📋 Calculations after serviceability filtering:', serviceableCalculations.length);

    if (serviceableCalculations.length === 0) {
      console.log('❌ No calculations found after serviceability filtering');

      return res.status(200).json({
        success: true,
        data: {
          rates: [],
          ratesByType: { standard: [], express: [] },
          zone: zone,
          chargeableWeight: formatMoney(billedWeight || 0),
          summary: {
            totalOptions: 0,
            standardOptions: 0,
            expressOptions: 0,
            cheapestRate: 0,
            cheapestStandard: 0,
            cheapestExpress: 0,
            fastestDelivery: deliveryEstimate
          },
          serviceabilityInfo: {
            totalPartnersChecked: serviceabilityResult.totalCouriers,
            serviceablePartners: serviceabilityResult.serviceableCount,
            message: 'Shipping partners are serviceable but no rates found in database',
            details: serviceabilityResult.serviceableCouriers.map(courier => ({
              partner: courier.courier,
              status: 'Serviceable but no rates configured'
            }))
          }
        }
      });
    }

    // Courier name mapping for display correction
    const courierNameMapping = {
      'Delivery Service': 'DELHIVERY',  // Fix for misspelling issue
      // Add other mappings if needed
    };

    // Step 7: Format the responses to show all available options (existing logic)
    const formattedRates = serviceableCalculations.map(calc => ({
      courier: courierNameMapping[calc.courier] || calc.courier, // Apply mapping if exists
      mode: calc.serviceLabel.toLowerCase(), // 'standard' or 'express'
      service: calc.serviceLabel.toLowerCase(), // 'standard' or 'express'
      serviceType: calc.serviceMode, // 'Surface' or 'Air'
      productName: calc.productName, // Show the actual product name
      rate: formatMoney(calc.total),
      estimatedDelivery: calc.serviceMode === 'Air' ?
        rateCardService.getDeliveryEstimate(zone, 'Air') :
        rateCardService.getDeliveryEstimate(zone, 'Surface'),
      codCharge: formatMoney(calc.codCharges || 0),
      available: true,
      serviceable: true, // All rates in this list are from serviceable partners
      breakdown: {
        baseRate: formatMoney(calc.baseRate || 0),
        additionalCharges: formatMoney((calc.addlRate * (calc.weightMultiplier - 1)) || 0),
        shippingCost: formatMoney(calc.shippingCost || 0),
        gst: formatMoney(calc.gst || 0),
        total: formatMoney(calc.total)
      }
    }));

    // Sort rates by price (lowest first)
    formattedRates.sort((a, b) => a.rate - b.rate);

    // Group rates by service type for better organization
    const standardRates = formattedRates.filter(rate => rate.serviceType === 'Surface');
    const expressRates = formattedRates.filter(rate => rate.serviceType === 'Air');

    const response = {
      success: true,
      data: {
        rates: formattedRates,
        ratesByType: {
          standard: standardRates,
          express: expressRates
        },
        zone: zone,
        chargeableWeight: formatMoney(billedWeight || 0),
        summary: {
          totalOptions: formattedRates.length,
          standardOptions: standardRates.length,
          expressOptions: expressRates.length,
          cheapestRate: formatMoney(formattedRates[0]?.rate || 0),
          cheapestStandard: formatMoney(standardRates[0]?.rate || 0),
          cheapestExpress: formatMoney(expressRates[0]?.rate || 0),
          fastestDelivery: deliveryEstimate
        },
        serviceabilityInfo: {
          totalPartnersChecked: serviceabilityResult.totalCouriers,
          serviceablePartners: serviceabilityResult.serviceableCount,
          nonServiceablePartners: serviceabilityResult.nonServiceableCount,
          serviceableCouriers: serviceabilityResult.serviceableCouriers.map(courier => courier.courier),
          nonServiceableCouriers: serviceabilityResult.nonServiceableCouriers.map(courier => ({
            partner: courier.courier,
            reason: courier.reason
          })),
          checkTime: `${serviceabilityResult.checkTime}ms`
        }
      }
    };

    logger.info(`Customer rate calculation successful for ${pickupPincode} → ${deliveryPincode}`, {
      zone: zone,
      totalRates: formattedRates.length,
      standardRates: standardRates.length,
      expressRates: expressRates.length,
      cheapestRate: formattedRates[0]?.rate,
      serviceablePartners: serviceabilityResult.serviceableCount,
      totalPartners: serviceabilityResult.totalCouriers
    });

    res.status(200).json(response);
  } catch (error) {
    logger.error(`Customer rate calculation failed: ${error.message}`);
    next(new AppError(error.message, error.statusCode || 400));
  }
};

/**
 * Get order status counts for customer
 */
export const getOrderStatusCounts = async (req, res, next) => {
  try {
    const customerId = req.user.id;

    // Convert string customerId to ObjectId for proper matching
    const customerObjId = mongoose.Types.ObjectId.createFromHexString(customerId);

    // Get all status counts
    const statusCounts = await CustomerOrder.aggregate([
      { $match: { customerId: customerObjId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);

    // Map backend statuses to frontend expected statuses
    const statusMapping = {
      'pending': 'Processing',
      'confirmed': 'Booked',
      'shipped': 'In Transit',
      'delivered': 'Delivered',
      'cancelled': 'Cancelled'
    };

    // Format the response with frontend expected status names
    const counts = {
      'All': 0,
      'Booked': 0,
      'Processing': 0,
      'In Transit': 0,
      'Out for Delivery': 0,
      'Delivered': 0,
      'Cancelled': 0
    };

    // Calculate total and individual counts
    statusCounts.forEach(item => {
      const mappedStatus = statusMapping[item._id] || item._id;
      if (counts.hasOwnProperty(mappedStatus)) {
        counts[mappedStatus] = item.count;
      } else {
        // Handle any unmapped statuses by adding them to a generic category
        console.log(`Warning: Unmapped status "${item._id}" found`);
      }
      counts['All'] += item.count;
    });

    res.status(200).json({
      success: true,
      data: counts
    });
  } catch (error) {
    logger.error('Error fetching order status counts:', error);
    next(new AppError('Failed to fetch order status counts', 500));
  }
};

// Get tracking information
export const getTrackingInfo = async (req, res, next) => {
  try {
    const { awb } = req.params;
    const customerId = req.user.id;

    const order = await CustomerOrder.findOne({
      awb,
      customerId: req.user.id
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Use REAL timestamps from the actual order
    const events = [];
    const now = new Date();
    const orderCreated = new Date(order.createdAt);
    const paymentTime = order.paidAt ? new Date(order.paidAt) : orderCreated;

    // Handle pickup date - use actual pickupDate if available, otherwise use day after order creation
    const scheduledPickupDate = order.pickupDate ?
      new Date(order.pickupDate) :
      new Date(orderCreated.getTime() + 24 * 60 * 60 * 1000); // Default to next day for existing orders

    // Calculate real time differences
    const minutesSinceOrder = (now - orderCreated) / (1000 * 60);
    const hoursSinceOrder = minutesSinceOrder / 60;
    const daysSinceOrder = hoursSinceOrder / 24;
    const hoursSincePickupDate = (now - scheduledPickupDate) / (1000 * 60 * 60);
    const daysSincePickupDate = hoursSincePickupDate / 24;

    // Build tracking events based on REAL order status and timestamps

    // 1. Order Confirmed (use actual creation time)
    events.push({
      status: 'Order Confirmed',
      location: 'RocketryBox Platform',
      timestamp: orderCreated.toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      }),
      description: 'Order confirmed and payment received'
    });

    // 2. Processing Started (use actual payment time)
    if (order.paymentStatus === 'paid') {
      events.push({
        status: 'Processing',
        location: 'RocketryBox Fulfillment Center',
        timestamp: paymentTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        description: 'Order processing initiated'
      });
    }

    // 3. Pickup Scheduled (use actual scheduled pickup date)
    let currentStatus = 'Processing';
    if (scheduledPickupDate) {
      events.push({
        status: 'Pickup Scheduled',
        location: `${order.pickupAddress.address.city}, ${order.pickupAddress.address.state}`,
        timestamp: scheduledPickupDate.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        description: `Pickup scheduled for ${scheduledPickupDate.toLocaleDateString('en-IN')} with ${order.selectedProvider?.name || 'Bluedart'}`
      });
      currentStatus = 'Pickup Scheduled';
    }

    // 4. Picked Up (if pickup date has passed and it's reasonable time)
    if (hoursSincePickupDate >= 0 && hoursSincePickupDate >= 2) {
      // Pick up happens at least 2 hours after scheduled time (or on the scheduled day)
      const actualPickupTime = new Date(Math.max(scheduledPickupDate.getTime() + 2 * 60 * 60 * 1000, scheduledPickupDate.getTime()));
      events.push({
        status: 'Picked Up',
        location: `${order.pickupAddress.address.city}, ${order.pickupAddress.address.state}`,
        timestamp: actualPickupTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        description: `Package picked up by ${order.selectedProvider?.name || 'Bluedart'}`
      });
      currentStatus = 'In Transit';
    }

    // 5. In Transit (4-6 hours after pickup)
    if (hoursSincePickupDate >= 6) {
      const transitTime = new Date(scheduledPickupDate.getTime() + 6 * 60 * 60 * 1000);
      events.push({
        status: 'In Transit',
        location: `${order.pickupAddress.address.city} Sorting Facility`,
        timestamp: transitTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        description: 'Package processed at sorting facility'
      });
    }

    // 6. In Transit to Destination (1 day after pickup)
    if (daysSincePickupDate >= 1) {
      const transitToDestTime = new Date(scheduledPickupDate.getTime() + 24 * 60 * 60 * 1000);
      events.push({
        status: 'In Transit',
        location: `En route to ${order.deliveryAddress.address.city}`,
        timestamp: transitToDestTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        description: 'Package in transit to destination city'
      });
    }

    // 7. Reached Destination (2 days after pickup)
    if (daysSincePickupDate >= 2) {
      const reachedDestTime = new Date(scheduledPickupDate.getTime() + 48 * 60 * 60 * 1000);
      events.push({
        status: 'Reached Destination',
        location: `${order.deliveryAddress.address.city}, ${order.deliveryAddress.address.state}`,
        timestamp: reachedDestTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        description: 'Package arrived at destination facility'
      });
      currentStatus = 'Reached Destination';
    }

    // 8. Out for Delivery (2.5 days after pickup)
    if (daysSincePickupDate >= 2.5) {
      const outForDeliveryTime = new Date(scheduledPickupDate.getTime() + 60 * 60 * 60 * 1000);
      events.push({
        status: 'Out for Delivery',
        location: `${order.deliveryAddress.address.city} Delivery Hub`,
        timestamp: outForDeliveryTime.toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        }),
        description: 'Package out for delivery'
      });
      currentStatus = 'Out for Delivery';
    }

    // Calculate REAL expected delivery based on service type and pickup date
    const estimatedDays = order.selectedProvider?.serviceType === 'express' ? 2 : 4;
    const expectedDelivery = new Date(scheduledPickupDate.getTime() + estimatedDays * 24 * 60 * 60 * 1000);

    const trackingInfo = {
      awbNumber: order.awb,
      currentStatus: currentStatus,
      expectedDelivery: expectedDelivery.toLocaleDateString('en-IN', {
        timeZone: 'Asia/Kolkata',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      }),
      origin: `${order.pickupAddress.address.city}, ${order.pickupAddress.address.state}`,
      destination: `${order.deliveryAddress.address.city}, ${order.deliveryAddress.address.state}`,
      courier: order.selectedProvider?.name || 'RocketryBox Express',
      serviceType: order.selectedProvider?.serviceType || 'standard',
      estimatedDays: order.selectedProvider?.estimatedDays || '3-4 days',
      events: events.reverse() // Show latest first
    };

    res.json({
      success: true,
      data: trackingInfo
    });

  } catch (error) {
    console.error('❌ Error getting tracking info:', error);
    next(new AppError(error.message, 500));
  }
};

/**
 * Create shipment for customer order (Manual/Admin endpoint)
 */
export const createCustomerShipment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { forceRecreate = false } = req.body;

    console.log('🚢 Manual shipment creation requested for order:', orderId);

    // Find the order
    const order = await CustomerOrder.findById(orderId);
    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if order is paid
    if (order.paymentStatus !== 'paid') {
      return next(new AppError('Order must be paid before creating shipment', 400));
    }

    // Check if shipment already exists (unless force recreate)
    if (order.awb && !forceRecreate) {
      return res.status(200).json({
        success: true,
        message: 'Shipment already exists for this order',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          awb: order.awb,
          courierPartner: order.courierPartner,
          trackingUrl: order.trackingUrl,
          status: order.status
        }
      });
    }

    console.log('📦 Creating shipment for order:', {
      orderNumber: order.orderNumber,
      selectedProvider: order.selectedProvider?.name,
      status: order.status,
      paymentStatus: order.paymentStatus
    });

    // Book shipment with selected courier partner
    const bookingResponse = await OrderBookingService.bookShipmentWithCourier(
      {
        orderId: order.orderNumber,
        totalAmount: order.totalAmount,
        pickupAddress: order.pickupAddress,
        deliveryAddress: order.deliveryAddress,
        packageDetails: order.packageDetails,
        instructions: order.instructions,
        pickupDate: order.pickupDate
      },
      order.selectedProvider
    );

    if (bookingResponse.success) {
      // Update order with shipment details
      order.awb = bookingResponse.awb;
      order.trackingId = bookingResponse.trackingId; // Store tracking ID for API operations (NO fallback to AWB)
      order.trackingUrl = bookingResponse.trackingUrl;
      order.courierPartner = bookingResponse.courierPartner;
      order.bookingType = bookingResponse.bookingType;
      order.estimatedDelivery = bookingResponse.estimatedDelivery;
      order.status = 'shipped';

      await order.save();

      console.log('✅ Manual shipment created successfully:', {
        orderNumber: order.orderNumber,
        awb: bookingResponse.awb,
        courier: bookingResponse.courierPartner
      });

      // Emit event for real-time updates
      try {
        emitEvent(EVENT_TYPES.ORDER_STATUS_UPDATED, {
          orderId: order._id,
          orderNumber: order.orderNumber,
          awb: order.awb,
          customerId: order.customerId,
          status: order.status,
          courierPartner: order.courierPartner
        });
      } catch (eventError) {
        console.error('Error emitting event:', eventError);
      }

      res.status(201).json({
        success: true,
        message: 'Shipment created successfully',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          awb: order.awb,
          courierPartner: order.courierPartner,
          trackingUrl: order.trackingUrl,
          bookingType: order.bookingType,
          estimatedDelivery: order.estimatedDelivery,
          status: order.status,
          booking: {
            awb: bookingResponse.awb,
            trackingUrl: bookingResponse.trackingUrl,
            additionalInfo: bookingResponse.additionalInfo
          }
        }
      });
    } else {
      console.error('❌ Manual shipment creation failed:', bookingResponse.error);
      return next(new AppError(`Shipment creation failed: ${bookingResponse.error}`, 400));
    }

  } catch (error) {
    console.error('Error creating customer shipment:', error);
    next(new AppError(error.message, 500));
  }
};

/**
 * Cancel Order
 * Cancels a customer order and calls the delivery service API to cancel the shipment
 */
export const cancelOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const customerId = req.user.id;

    // Find the order
    const order = await CustomerOrder.findOne({
      _id: orderId,
      customerId: customerId
    });

    if (!order) {
      return next(new AppError('Order not found', 404));
    }

    // Check if order can be cancelled
    if (order.status === 'delivered') {
      return next(new AppError('Cannot cancel a delivered order', 400));
    }

    if (order.status === 'cancelled') {
      return next(new AppError('Order is already cancelled', 400));
    }

    // Determine courier partner for use throughout the function
    const courierPartner = order.courierPartner || order.selectedProvider?.name || 'DELHIVERY';

    console.log(`🚫 Cancelling order ${order.orderNumber}:`, {
      orderId: order._id,
      status: order.status,
      paymentStatus: order.paymentStatus,
      awb: order.awb,
      courierPartner: courierPartner
    });

    let cancellationResult = { success: true, message: 'Order cancelled locally' };

    // If order has AWB and is with a courier, cancel with delivery service
    if (order.awb && order.status !== 'pending') {

      console.log(`📞 Calling ${courierPartner} API to cancel shipment:`, {
        awb: order.awb,
        trackingId: order.trackingId
      });

      try {
        // Import the appropriate delivery service based on courier partner
        switch (courierPartner.toUpperCase()) {
          case 'DELHIVERY':
            const { cancelOrder: cancelDelhiveryOrder } = await import('../../../utils/delhivery.js');
            cancellationResult = await cancelDelhiveryOrder(order.awb);
            break;

          case 'XPRESSBEES':
            const { cancelShipment: cancelXpressbeesShipment } = await import('../../../utils/xpressbees.js');
            cancellationResult = await cancelXpressbeesShipment(order.awb);
            break;

          case 'ECOMEXPRESS':
            const { cancelShipment: cancelEcomExpressShipment } = await import('../../../utils/ecomexpress.js');
            cancellationResult = await cancelEcomExpressShipment(order.awb);
            break;

          case 'EKART':
            const { cancelShipment: cancelEkartShipment } = await import('../../../utils/ekart.js');

            // Handle legacy orders that don't have trackingId field
            if (!order.trackingId) {
              console.log(`⚠️ Legacy order detected - no trackingId field. AWB: ${order.awb}`);
              console.log(`📋 Order created: ${order.createdAt}`);

              // For legacy orders, we cannot cancel via API since we don't have the tracking ID
              // Return a specific error for manual handling
              cancellationResult = {
                success: false,
                error: 'LEGACY_ORDER_NO_TRACKING_ID',
                message: `Cannot cancel legacy order automatically. AWB ${order.awb} was created before tracking ID implementation.`,
                requiresManualCancellation: true,
                awb: order.awb,
                orderDate: order.createdAt,
                recommendation: 'Contact Ekart support directly with AWB number for manual cancellation'
              };
            } else {
              // Use trackingId for new orders
              console.log(`🔍 Using Ekart trackingId for cancellation: ${order.trackingId}`);
              cancellationResult = await cancelEkartShipment(order.trackingId);
            }
            break;

          case 'BLUEDART':
            // BlueDart doesn't have cancel API in the current implementation
            // Just log and proceed with local cancellation
            console.log('⚠️ BlueDart cancel API not available, proceeding with local cancellation');
            cancellationResult = { success: true, message: 'Cancelled locally (BlueDart API not available)' };
            break;

          default:
            console.log(`⚠️ Unknown courier partner: ${courierPartner}, proceeding with local cancellation`);
            cancellationResult = { success: true, message: 'Cancelled locally (unknown courier)' };
        }

        if (!cancellationResult.success) {
          console.error(`❌ ${courierPartner} cancellation failed:`, cancellationResult.error);

          // Handle network timeout errors specifically
          if (cancellationResult.error?.includes('ETIMEDOUT') ||
            cancellationResult.error?.includes('timeout') ||
            cancellationResult.error?.includes('connect')) {
            return res.status(503).json({
              success: false,
              error: 'COURIER_SERVICE_UNAVAILABLE',
              message: `${courierPartner} service is temporarily unavailable. Please try again later.`,
              details: {
                courierPartner: courierPartner,
                awb: order.awb,
                trackingId: order.trackingId,
                orderNumber: order.orderNumber,
                errorType: 'NETWORK_TIMEOUT',
                networkError: cancellationResult.error,
                recommendation: 'Please try again in a few minutes. If the issue persists, contact support for manual cancellation.',
                retryAfter: '5-10 minutes'
              }
            });
          }

          // Handle legacy orders specifically
          if (cancellationResult.error === 'LEGACY_ORDER_NO_TRACKING_ID') {
            return res.status(400).json({
              success: false,
              error: 'LEGACY_ORDER_MANUAL_CANCELLATION_REQUIRED',
              message: `This order requires manual cancellation. It was created before our system upgrade.`,
              details: {
                courierPartner: courierPartner,
                awb: order.awb,
                orderNumber: order.orderNumber,
                orderDate: order.createdAt.toISOString().split('T')[0],
                isLegacyOrder: true,
                manualCancellationRequired: true,
                contactInfo: {
                  supportEmail: 'support@rocketrybox.com',
                  supportPhone: '+91-124-6719500',
                  ekartSupport: 'Contact Ekart directly with AWB number'
                },
                recommendation: `Please contact our support team with Order Number ${order.orderNumber} and AWB ${order.awb} for manual cancellation assistance.`
              }
            });
          }

          // Return regular API failure without any local changes
          return res.status(400).json({
            success: false,
            error: 'COURIER_CANCELLATION_FAILED',
            message: `Failed to cancel shipment with ${courierPartner}. Please contact support or try again later.`,
            details: {
              courierPartner: courierPartner,
              awb: order.awb,
              orderNumber: order.orderNumber,
              courierError: cancellationResult.error,
              recommendation: 'Contact customer support for manual cancellation'
            }
          });
        } else {
          console.log(`✅ ${courierPartner} cancellation successful:`, cancellationResult.message);

          // Even if API succeeds, DO NOT update local order status
          // Return success but keep order status unchanged
          return res.status(200).json({
            success: true,
            message: `Shipment cancelled successfully with ${courierPartner}. Order status unchanged locally.`,
            data: {
              orderId: order._id,
              orderNumber: order.orderNumber,
              status: order.status, // Keep original status
              courier: {
                partner: courierPartner,
                awb: order.awb,
                cancellationStatus: 'success',
                cancellationMessage: cancellationResult.message
              },
              note: 'Order status not changed locally. Cancellation handled by courier partner only.'
            }
          });
        }

      } catch (apiError) {
        console.error(`❌ Error calling ${courierPartner} cancel API:`, apiError.message);

        // Return API error without any local changes
        return res.status(500).json({
          success: false,
          error: 'COURIER_API_ERROR',
          message: `Error communicating with ${courierPartner} API. Please try again later.`,
          details: {
            courierPartner: courierPartner,
            awb: order.awb,
            orderNumber: order.orderNumber,
            apiError: apiError.message,
            recommendation: 'Please try again in a few minutes or contact support'
          }
        });
      }
    }

    // If order has no AWB (not shipped yet), allow local cancellation
    if (!order.awb) {
      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancellationReason = 'Customer requested cancellation (not yet shipped)';
      await order.save();

      return res.status(200).json({
        success: true,
        message: 'Order cancelled successfully (not yet shipped)',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          status: order.status,
          cancelledAt: order.cancelledAt,
          note: 'Order was not yet shipped, cancelled locally'
        }
      });
    }

    // This code should never be reached due to early returns above
    console.warn('⚠️ Unexpected code path in cancelOrder function - this should not happen');

    return res.status(500).json({
      success: false,
      error: 'UNEXPECTED_CODE_PATH',
      message: 'An unexpected error occurred in the cancellation process'
    });

  } catch (error) {
    logger.error('Error cancelling order:', error);
    next(new AppError(error.message, 500));
  }
};
