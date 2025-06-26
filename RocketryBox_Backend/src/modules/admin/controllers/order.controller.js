import { AppError } from '../../../middleware/errorHandler.js';
import { CACHE_TTL, getCache, setCache } from '../../../utils/cache.js';
import { logger } from '../../../utils/logger.js';
import { getIO } from '../../../utils/socketio.js';
import CustomerOrder from '../../customer/models/customerOrder.model.js';
import SellerOrder from '../../seller/models/order.model.js';

/**
 * Get orders with pagination and filtering
 * @route GET /api/admin/orders
 * @access Private (Admin only)
 */
export const getOrders = async (req, res, next) => {
  try {
    console.log('🔄 Admin getOrders called with params:', req.query);

    const {
      page = 1,
      limit = 10,
      type = 'seller', // Default to 'seller' instead of 'all' for better performance
      status,
      search,
      from,
      to,
      sortField = 'createdAt',
      sortOrder = 'desc',
      paymentType,
      priority
    } = req.query;

    // Simplified cache key
    const cacheKey = `admin:orders:${type}:${page}:${limit}:${status || 'all'}`;

    try {
      const cachedData = await getCache(cacheKey);

      if (cachedData) {
        console.log('✅ Returning cached data');
        return res.status(200).json({
          success: true,
          data: cachedData.data,
          pagination: cachedData.pagination,
          isFromCache: true
        });
      }
    } catch (cacheError) {
      console.warn('Cache error, proceeding without cache:', cacheError.message);
    }

    console.log(`🗃️ Querying ${type} orders from database...`);

    // Simplified query building without complex timeout
    let query = {};
    let Model = SellerOrder; // Default to seller orders for better performance

    // Set model based on type first
    if (type === 'customer') {
      Model = CustomerOrder;
    }

    // Build date filter
    if (from || to) {
      query.createdAt = {};
      if (from) query.createdAt.$gte = new Date(from);
      if (to) query.createdAt.$lte = new Date(to);
    }

    // Build filters based on type
    if (type === 'customer') {
      if (status) {
        // Map frontend status to customer order status
        const statusMapping = {
          'Booked': 'pending',
          'Processing': 'confirmed',
          'In Transit': 'shipped',
          'Delivered': 'delivered',
          'Cancelled': 'cancelled'
        };
        query.status = statusMapping[status] || status.toLowerCase();
      }
      if (paymentType) query.paymentStatus = paymentType === 'COD' ? 'pending' : 'paid';

      // Simplified search for customer orders
      if (search) {
        query.$or = [
          { orderNumber: { $regex: search, $options: 'i' } },
          { awb: { $regex: search, $options: 'i' } }
        ];
      }
    } else {
      // Seller orders (default)
      if (status) query.status = status;
      if (paymentType) query['payment.method'] = paymentType;

      // Simplified search for seller orders
      if (search) {
        query.$or = [
          { orderId: { $regex: search, $options: 'i' } }
        ];
      }
    }

    console.log('📝 Query:', query);
    console.log('📝 Model:', Model.modelName);
    console.log('📝 Collection:', Model.collection.name);
    console.log('📝 Database:', Model.db.name);

    // Build sort object
    const sort = {};
    sort[sortField] = sortOrder === 'desc' ? -1 : 1;

    // Execute simplified query without timeout race condition
    console.log('🔍 Executing database query...');
    const orders = await Model.find(query)
      .sort(sort)
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .lean();

    console.log(`📦 Found ${orders.length} orders`);

    // Get count separately for better performance
    const totalCount = await Model.countDocuments(query);
    console.log(`📊 Total count: ${totalCount}`);

    // Add orderType and format amount for display
    const ordersWithType = orders.map(order => {
      const baseOrder = {
        ...order,
        orderType: type === 'customer' ? 'customer' : 'seller'
      };

      // Format amount based on order type for proper display
      if (type === 'customer') {
        // Customer orders may have totalAmount, amount, or shippingRate fields
        console.log(`🔍 Customer order ${order._id} raw data:`, {
          totalAmount: order.totalAmount,
          amount: order.amount,
          shippingRate: order.shippingRate,
          selectedProvider: order.selectedProvider
        });

        const customerAmount = order.totalAmount || order.amount || order.shippingRate ||
          order.selectedProvider?.totalRate || 0;

        baseOrder.displayAmount = customerAmount;
        baseOrder.formattedAmount = customerAmount ? `₹${customerAmount}` : '₹0';
        console.log(`💰 Customer order ${order._id}: detected amount=${customerAmount} -> formatted=${baseOrder.formattedAmount}`);
      } else {
        // Seller orders have payment.total field
        const paymentTotal = order.payment?.total;
        if (paymentTotal) {
          // Convert string to number if needed
          const numericAmount = typeof paymentTotal === 'string' ?
            parseFloat(paymentTotal.replace(/[^0-9.-]/g, '')) : paymentTotal;
          baseOrder.displayAmount = numericAmount || 0;
          baseOrder.formattedAmount = `₹${numericAmount || 0}`;
          console.log(`💰 Seller order ${order._id}: payment.total=${paymentTotal} -> formatted=${baseOrder.formattedAmount}`);
        } else {
          baseOrder.displayAmount = 0;
          baseOrder.formattedAmount = '₹0';
          console.log(`💰 Seller order ${order._id}: no payment.total -> formatted=₹0`);
        }
      }

      return baseOrder;
    });

    // Prepare response
    const response = {
      data: ordersWithType,
      pagination: {
        total: totalCount,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    };

    // Try to cache the results, but don't fail if cache fails
    try {
      await setCache(cacheKey, response, 300);
      console.log('💾 Results cached successfully');
    } catch (cacheError) {
      console.warn('Failed to cache results:', cacheError.message);
    }

    console.log('✅ Sending successful response');
    res.status(200).json({
      success: true,
      ...response
    });
  } catch (error) {
    console.error('❌ Error in getOrders:', error.message);
    console.error('❌ Error stack:', error.stack);

    logger.error(`Error in getOrders: ${error.message}`);

    // Send error response
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch orders',
      message: error.message
    });
  }
};

/**
 * Get order details
 * @route GET /api/admin/orders/:id
 * @access Private (Admin only)
 */
export const getOrderDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { type } = req.query; // Optional: 'seller' or 'customer'

    // Try to get from cache first
    const cacheKey = `admin:order:${id}:${type || 'auto'}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        isFromCache: true
      });
    }

    let order;
    let orderData;
    let orderType;

    // If type is specified, check only that model
    if (type === 'seller') {
      order = await SellerOrder.findById(id)
        .populate('seller', 'name email phone businessName address')
        .lean();

      if (!order) {
        return next(new AppError('Seller order not found', 404));
      }

      orderType = 'seller';
    } else if (type === 'customer') {
      order = await CustomerOrder.findById(id)
        .populate('customerId', 'name email phone')
        .lean();

      if (!order) {
        return next(new AppError('Customer order not found', 404));
      }

      orderType = 'customer';
    } else {
      // Try both models if type is not specified
      order = await SellerOrder.findById(id)
        .populate('seller', 'name email phone businessName address')
        .lean();

      if (order) {
        orderType = 'seller';
      } else {
        order = await CustomerOrder.findById(id)
          .populate('customerId', 'name email phone')
          .lean();

        if (order) {
          orderType = 'customer';
        } else {
          return next(new AppError('Order not found', 404));
        }
      }
    }

    // Format the order data based on type
    if (orderType === 'seller') {
      orderData = {
        id: order._id,
        orderId: order.orderId,
        date: order.orderDate,
        customer: {
          name: order.customer.name,
          email: order.customer.email,
          phone: order.customer.phone,
          address: `${order.customer.address.street}, ${order.customer.address.city}, ${order.customer.address.state} - ${order.customer.address.pincode}`
        },
        items: [{
          name: order.product.name,
          sku: order.product.sku,
          quantity: order.product.quantity,
          price: parseFloat(order.product.price),
          total: parseFloat(order.product.price) * order.product.quantity,
          weight: order.product.weight
        }],
        seller: order.seller ? {
          id: order.seller._id,
          name: order.seller.name,
          businessName: order.seller.businessName,
          email: order.seller.email,
          phone: order.seller.phone,
          address: order.seller.address ? {
            address1: order.seller.address.address1,
            address2: order.seller.address.address2,
            city: order.seller.address.city,
            state: order.seller.address.state,
            pincode: order.seller.address.pincode,
            country: order.seller.address.country
          } : null
        } : null,
        amount: order.payment.total,
        payment: order.payment.method,
        codCharge: order.payment.codCharge,
        shippingCharge: order.payment.shippingCharge,
        channel: order.channel,
        weight: order.product.weight,
        status: order.status,
        awbNumber: order.awb,
        courier: order.courier,
        tracking: order.tracking,
        timeline: order.orderTimeline,
        notes: order.notes,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt
      };
    } else {
      // Format customer order data with proper null checks
      console.log('🔄 Formatting customer order data:', order);

      try {
        orderData = {
          id: order._id,
          awb: order.awb || '',
          date: order.createdAt,
          customer: {
            id: order.customerId ? order.customerId._id : null,
            name: order.deliveryAddress ? order.deliveryAddress.name : 'Unknown',
            email: order.customerId ? order.customerId.email : null,
            phone: order.deliveryAddress ? order.deliveryAddress.phone : null,
            address: order.deliveryAddress && order.deliveryAddress.address ?
              `${order.deliveryAddress.address.line1 || ''}${order.deliveryAddress.address.line2 ? '\n' + order.deliveryAddress.address.line2 : ''}\n${order.deliveryAddress.address.city || ''}, ${order.deliveryAddress.address.state || ''} ${order.deliveryAddress.address.pincode || ''}\n${order.deliveryAddress.address.country || ''}` :
              'Address not available'
          },
          pickupAddress: order.pickupAddress || {},
          deliveryAddress: order.deliveryAddress || {},
          items: (() => {
            // Try multiple possible locations for items data
            if (order.package && order.package.items && order.package.items.length > 0) {
              return order.package.items.map(item => ({
                name: item.name || 'Unknown Item',
                quantity: item.quantity || 1,
                value: item.value || 0,
                total: (item.value || 0) * (item.quantity || 1)
              }));
            }

            // Try packageDetails structure
            if (order.packageDetails) {
              return [{
                name: 'Package Item',
                quantity: 1,
                value: order.packageDetails.declaredValue || 100, // Product declared value
                total: order.packageDetails.declaredValue || 100,
                type: 'product' // Mark as product item
              }];
            }

            // Fallback: create generic item based on declared value, not shipping charges
            return [{
              name: 'Package Item',
              quantity: 1,
              value: 100, // Default product value
              total: 100,
              type: 'product'
            }];

            return [];
          })(),
          package: {
            weight: order.package ? order.package.weight : order.packageDetails ? order.packageDetails.weight : 0,
            dimensions: order.package ? order.package.dimensions : order.packageDetails ? order.packageDetails.dimensions : {}
          },
          amount: order.totalAmount || order.amount || 0, // For customer orders: shipping charges only (prepaid)
          productValue: order.packageDetails?.declaredValue || 100, // Product value (declared for customs)
          shippingCharges: order.shippingRate || order.totalAmount || order.amount || 0, // Shipping charges
          paymentType: 'Prepaid', // Customer orders are always prepaid
          payment: 'Prepaid', // Customer orders are always prepaid
          serviceType: order.serviceType || order.selectedProvider ? order.selectedProvider.serviceType : 'Unknown',
          status: order.status || 'Unknown',
          estimatedDelivery: order.estimatedDelivery,
          tracking: order.tracking || {},
          courier: order.courier || order.courierPartner || '',
          instructions: order.instructions || '',
          createdAt: order.createdAt,
          updatedAt: order.updatedAt
        };

        console.log('✅ Customer order formatted successfully:', orderData);
      } catch (formatError) {
        console.error('❌ Error formatting customer order:', formatError);
        throw new Error(`Failed to format customer order: ${formatError.message}`);
      }
    }

    // Add the order type to the response
    orderData.orderType = orderType;

    // Cache the order data
    await setCache(cacheKey, orderData, CACHE_TTL.ORDER_DETAILS);

    res.status(200).json({
      success: true,
      data: orderData
    });
  } catch (error) {
    logger.error(`Error in getOrderDetails: ${error.message}`);
    next(new AppError('Failed to fetch order details', 500));
  }
};

/**
 * Update order status
 * @route PATCH /api/admin/orders/:id/status
 * @access Private (Admin only)
 */
export const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason, type } = req.body;

    if (!status) {
      return next(new AppError('Status is required', 400));
    }

    let order;
    let updatedOrder;
    let orderType;

    // Determine order type if not specified
    if (!type) {
      // Try seller order first
      order = await SellerOrder.findById(id);

      if (order) {
        orderType = 'seller';
      } else {
        // Try customer order
        order = await CustomerOrder.findById(id);

        if (order) {
          orderType = 'customer';
        } else {
          return next(new AppError('Order not found', 404));
        }
      }
    } else {
      // Use specified type
      if (type === 'seller') {
        order = await SellerOrder.findById(id);
        orderType = 'seller';
      } else if (type === 'customer') {
        order = await CustomerOrder.findById(id);
        orderType = 'customer';
      } else {
        return next(new AppError('Invalid order type', 400));
      }

      if (!order) {
        return next(new AppError('Order not found', 404));
      }
    }

    // Update order status based on type
    if (orderType === 'seller') {
      // Validate seller order status
      const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

      if (!validStatuses.includes(status)) {
        return next(new AppError(`Invalid status for seller order: ${status}`, 400));
      }

      // Use the helper method to update status if available
      if (typeof order.updateStatus === 'function') {
        updatedOrder = await order.updateStatus(status, reason || '', req.user.id);
      } else {
        // Fallback if helper method not available
        order.status = status;

        // Add to timeline
        if (!order.orderTimeline) {
          order.orderTimeline = [];
        }

        order.orderTimeline.push({
          status,
          timestamp: new Date(),
          comment: reason || `Order marked as ${status.toLowerCase()} by admin`
        });

        // Add a note if provided
        if (!order.notes) {
          order.notes = [];
        }

        if (reason) {
          order.notes.push({
            note: `Status changed to ${status}: ${reason}`,
            createdBy: req.user.id,
            createdAt: new Date()
          });
        }

        updatedOrder = await order.save();
      }
    } else {
      // Customer order
      const validStatuses = ['Booked', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled'];

      if (!validStatuses.includes(status)) {
        return next(new AppError(`Invalid status for customer order: ${status}`, 400));
      }

      // Use the helper method to update status if available
      if (typeof order.updateStatus === 'function') {
        updatedOrder = await order.updateStatus(status, reason || '');
      } else {
        // Fallback if helper method not available
        order.status = status;

        // Update tracking timeline
        if (!order.tracking) {
          order.tracking = {
            status,
            timeline: []
          };
        }

        order.tracking.status = status;
        order.tracking.timeline.push({
          status,
          timestamp: new Date(),
          description: reason || `Order ${status.toLowerCase()} by admin`
        });

        updatedOrder = await order.save();
      }
    }

    // Invalidate cache for this order
    const cacheKeys = [
      `admin:order:${id}:auto`,
      `admin:order:${id}:${orderType}`
    ];

    for (const key of cacheKeys) {
      await setCache(key, null, 0);
    }

    // Use Socket.io to broadcast the update
    try {
      const io = getIO();

      // Broadcast to admin dashboard
      io.to('admin-dashboard').emit('order:status:updated', {
        orderId: id,
        orderType,
        status,
        updatedBy: req.user.id,
        timestamp: new Date()
      });

      logger.info(`Order status update broadcasted for ${id}`);
    } catch (socketError) {
      logger.warn(`Failed to broadcast order status update: ${socketError.message}`);
    }

    res.status(200).json({
      success: true,
      data: {
        id: updatedOrder._id,
        status: updatedOrder.status,
        message: `Order status updated to ${status}`
      }
    });
  } catch (error) {
    logger.error(`Error in updateOrderStatus: ${error.message}`);
    next(new AppError(`Failed to update order status: ${error.message}`, 500));
  }
};

/**
 * Bulk update order statuses
 * @route PATCH /api/admin/orders/bulk-status
 * @access Private (Admin only)
 */
export const bulkUpdateOrderStatus = async (req, res, next) => {
  try {
    const { orderIds, status, reason, type } = req.body;

    if (!orderIds || !Array.isArray(orderIds) || orderIds.length === 0) {
      return next(new AppError('Order IDs array is required', 400));
    }

    if (!status) {
      return next(new AppError('Status is required', 400));
    }

    // Limit the number of orders that can be updated at once
    const MAX_BULK_ORDERS = 50;
    if (orderIds.length > MAX_BULK_ORDERS) {
      return next(new AppError(`Cannot update more than ${MAX_BULK_ORDERS} orders at once`, 400));
    }

    let results = {
      updated: 0,
      failed: 0,
      errors: []
    };

    // Separate processing for seller and customer orders
    if (type === 'seller') {
      const validStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

      if (!validStatuses.includes(status)) {
        return next(new AppError(`Invalid status for seller order: ${status}`, 400));
      }

      // Find all seller orders
      const orders = await SellerOrder.find({ _id: { $in: orderIds } });

      // Process each order
      for (const order of orders) {
        try {
          // Update status
          order.status = status;

          // Add to timeline
          if (!order.orderTimeline) {
            order.orderTimeline = [];
          }

          order.orderTimeline.push({
            status,
            timestamp: new Date(),
            comment: reason || `Bulk update: Order marked as ${status.toLowerCase()} by admin`
          });

          // Add a note if provided
          if (!order.notes) {
            order.notes = [];
          }

          if (reason) {
            order.notes.push({
              note: `Bulk update: Status changed to ${status}: ${reason}`,
              createdBy: req.user.id,
              createdAt: new Date()
            });
          }

          await order.save();
          results.updated++;

          // Invalidate cache for this order
          await setCache(`admin:order:${order._id}:auto`, null, 0);
          await setCache(`admin:order:${order._id}:seller`, null, 0);
        } catch (error) {
          results.failed++;
          results.errors.push({
            id: order._id,
            error: error.message
          });
          logger.error(`Error updating seller order ${order._id}: ${error.message}`);
        }
      }
    } else if (type === 'customer') {
      const validStatuses = ['Booked', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled'];

      if (!validStatuses.includes(status)) {
        return next(new AppError(`Invalid status for customer order: ${status}`, 400));
      }

      // Find all customer orders
      const orders = await CustomerOrder.find({ _id: { $in: orderIds } });

      // Process each order
      for (const order of orders) {
        try {
          // Update status
          order.status = status;

          // Update tracking timeline
          if (!order.tracking) {
            order.tracking = {
              status,
              timeline: []
            };
          }

          order.tracking.status = status;
          order.tracking.timeline.push({
            status,
            timestamp: new Date(),
            description: reason || `Bulk update: Order ${status.toLowerCase()} by admin`
          });

          await order.save();
          results.updated++;

          // Invalidate cache for this order
          await setCache(`admin:order:${order._id}:auto`, null, 0);
          await setCache(`admin:order:${order._id}:customer`, null, 0);
        } catch (error) {
          results.failed++;
          results.errors.push({
            id: order._id,
            error: error.message
          });
          logger.error(`Error updating customer order ${order._id}: ${error.message}`);
        }
      }
    } else {
      // Mixed type bulk update (more complex)
      // First, categorize orders by type
      const sellerOrderIds = [];
      const customerOrderIds = [];

      // Try to find each order in both models
      for (const orderId of orderIds) {
        const sellerOrder = await SellerOrder.findById(orderId);
        if (sellerOrder) {
          sellerOrderIds.push(orderId);
          continue;
        }

        const customerOrder = await CustomerOrder.findById(orderId);
        if (customerOrder) {
          customerOrderIds.push(orderId);
          continue;
        }

        // Order not found in either model
        results.failed++;
        results.errors.push({
          id: orderId,
          error: 'Order not found'
        });
      }

      // Process seller orders if any
      if (sellerOrderIds.length > 0) {
        const sellerValidStatuses = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

        if (!sellerValidStatuses.includes(status)) {
          results.failed += sellerOrderIds.length;
          for (const id of sellerOrderIds) {
            results.errors.push({
              id,
              error: `Invalid status for seller order: ${status}`
            });
          }
        } else {
          // Update seller orders
          const sellerOrders = await SellerOrder.find({ _id: { $in: sellerOrderIds } });

          for (const order of sellerOrders) {
            try {
              // Update status
              order.status = status;

              // Add to timeline
              if (!order.orderTimeline) {
                order.orderTimeline = [];
              }

              order.orderTimeline.push({
                status,
                timestamp: new Date(),
                comment: reason || `Bulk update: Order marked as ${status.toLowerCase()} by admin`
              });

              // Add a note if provided
              if (!order.notes) {
                order.notes = [];
              }

              if (reason) {
                order.notes.push({
                  note: `Bulk update: Status changed to ${status}: ${reason}`,
                  createdBy: req.user.id,
                  createdAt: new Date()
                });
              }

              await order.save();
              results.updated++;

              // Invalidate cache for this order
              await setCache(`admin:order:${order._id}:auto`, null, 0);
              await setCache(`admin:order:${order._id}:seller`, null, 0);
            } catch (error) {
              results.failed++;
              results.errors.push({
                id: order._id,
                error: error.message
              });
              logger.error(`Error updating seller order ${order._id}: ${error.message}`);
            }
          }
        }
      }

      // Process customer orders if any
      if (customerOrderIds.length > 0) {
        const customerValidStatuses = ['Booked', 'Processing', 'In Transit', 'Out for Delivery', 'Delivered', 'Failed', 'Cancelled'];

        if (!customerValidStatuses.includes(status)) {
          results.failed += customerOrderIds.length;
          for (const id of customerOrderIds) {
            results.errors.push({
              id,
              error: `Invalid status for customer order: ${status}`
            });
          }
        } else {
          // Update customer orders
          const customerOrders = await CustomerOrder.find({ _id: { $in: customerOrderIds } });

          for (const order of customerOrders) {
            try {
              // Update status
              order.status = status;

              // Update tracking timeline
              if (!order.tracking) {
                order.tracking = {
                  status,
                  timeline: []
                };
              }

              order.tracking.status = status;
              order.tracking.timeline.push({
                status,
                timestamp: new Date(),
                description: reason || `Bulk update: Order ${status.toLowerCase()} by admin`
              });

              await order.save();
              results.updated++;

              // Invalidate cache for this order
              await setCache(`admin:order:${order._id}:auto`, null, 0);
              await setCache(`admin:order:${order._id}:customer`, null, 0);
            } catch (error) {
              results.failed++;
              results.errors.push({
                id: order._id,
                error: error.message
              });
              logger.error(`Error updating customer order ${order._id}: ${error.message}`);
            }
          }
        }
      }
    }

    // Invalidate caches for order listings
    const cachePatterns = [
      'admin:orders:*'
    ];

    for (const pattern of cachePatterns) {
      try {
        // This requires a Redis client that supports pattern deletion
        // Implementation depends on the cache utility
      } catch (error) {
        logger.warn(`Failed to invalidate cache pattern ${pattern}: ${error.message}`);
      }
    }

    // Broadcast update via Socket.io
    try {
      const io = getIO();

      io.to('admin-dashboard').emit('orders:bulk-status:updated', {
        count: results.updated,
        status,
        updatedBy: req.user.id,
        timestamp: new Date()
      });

      logger.info(`Bulk order status update broadcasted for ${results.updated} orders`);
    } catch (socketError) {
      logger.warn(`Failed to broadcast bulk order status update: ${socketError.message}`);
    }

    res.status(200).json({
      success: true,
      data: {
        updated: results.updated,
        failed: results.failed,
        total: orderIds.length,
        errors: results.errors.length > 0 ? results.errors : undefined,
        message: `Updated ${results.updated} orders to status: ${status}`
      }
    });
  } catch (error) {
    logger.error(`Error in bulkUpdateOrderStatus: ${error.message}`);
    next(new AppError('Failed to update order statuses', 500));
  }
};

/**
 * Get order statistics
 * @route GET /api/admin/orders/stats
 * @access Private (Admin only)
 */
export const getOrderStats = async (req, res, next) => {
  try {
    const { from, to, type = 'all' } = req.query;

    // Try to get from cache first
    const cacheKey = `admin:orders:stats:${type}:${from || 'none'}:${to || 'none'}`;
    const cachedData = await getCache(cacheKey);

    if (cachedData) {
      return res.status(200).json({
        success: true,
        data: cachedData,
        isFromCache: true
      });
    }

    // Prepare date filter
    let dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    }

    // Get current time for today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Prepare statistics object based on type
    let stats = {
      total: 0,
      byStatus: {},
      byPaymentType: {},
      byDate: [],
      avgOrderValue: 0,
      today: 0,
      revenue: 0,
      todayRevenue: 0
    };

    // Process seller orders if type is 'seller' or 'all'
    if (type === 'seller' || type === 'all') {
      // Get order counts by status
      const sellerStatusStats = await SellerOrder.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Get order counts by payment type
      const sellerPaymentStats = await SellerOrder.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$payment.method', count: { $sum: 1 } } }
      ]);

      // Get today's order count
      const sellerTodayOrders = await SellerOrder.countDocuments({
        ...dateFilter,
        createdAt: { $gte: today }
      });

      // Get total orders
      const sellerTotalOrders = await SellerOrder.countDocuments(dateFilter);

      // Get revenue statistics
      const sellerRevenue = await SellerOrder.aggregate([
        { $match: { ...dateFilter, status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: { $toDouble: '$payment.total' } } } }
      ]).then(result => (result.length > 0 ? result[0].total : 0));

      // Get today's revenue
      const sellerTodayRevenue = await SellerOrder.aggregate([
        {
          $match: {
            status: { $ne: 'Cancelled' },
            createdAt: { $gte: today }
          }
        },
        { $group: { _id: null, total: { $sum: { $toDouble: '$payment.total' } } } }
      ]).then(result => (result.length > 0 ? result[0].total : 0));

      // Get orders by date for chart
      const sellerOrdersByDate = await SellerOrder.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: { $toDouble: '$payment.total' } }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Update stats for seller orders
      if (type === 'seller') {
        stats.total = sellerTotalOrders;
        stats.today = sellerTodayOrders;
        stats.revenue = sellerRevenue;
        stats.todayRevenue = sellerTodayRevenue;
        stats.avgOrderValue = sellerTotalOrders > 0 ? sellerRevenue / sellerTotalOrders : 0;

        // Process status stats
        sellerStatusStats.forEach(item => {
          stats.byStatus[item._id] = item.count;
        });

        // Process payment stats
        sellerPaymentStats.forEach(item => {
          stats.byPaymentType[item._id] = item.count;
        });

        // Process date stats
        stats.byDate = sellerOrdersByDate.map(item => ({
          date: item._id,
          count: item.count,
          revenue: item.revenue
        }));
      } else {
        // For 'all' type, accumulate seller stats
        stats.total += sellerTotalOrders;
        stats.today += sellerTodayOrders;
        stats.revenue += sellerRevenue;
        stats.todayRevenue += sellerTodayRevenue;

        // Process status stats
        sellerStatusStats.forEach(item => {
          stats.byStatus[item._id] = (stats.byStatus[item._id] || 0) + item.count;
        });

        // Process payment stats
        sellerPaymentStats.forEach(item => {
          stats.byPaymentType[item._id] = (stats.byPaymentType[item._id] || 0) + item.count;
        });

        // Save seller orders by date for later merging
        stats.sellerOrdersByDate = sellerOrdersByDate;
      }
    }

    // Process customer orders if type is 'customer' or 'all'
    if (type === 'customer' || type === 'all') {
      // Get order counts by status
      const customerStatusStats = await CustomerOrder.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);

      // Get order counts by payment type
      const customerPaymentStats = await CustomerOrder.aggregate([
        { $match: dateFilter },
        { $group: { _id: '$paymentMethod', count: { $sum: 1 } } }
      ]);

      // Get today's order count
      const customerTodayOrders = await CustomerOrder.countDocuments({
        ...dateFilter,
        createdAt: { $gte: today }
      });

      // Get total orders
      const customerTotalOrders = await CustomerOrder.countDocuments(dateFilter);

      // Get revenue statistics
      const customerRevenue = await CustomerOrder.aggregate([
        { $match: { ...dateFilter, status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => (result.length > 0 ? result[0].total : 0));

      // Get today's revenue
      const customerTodayRevenue = await CustomerOrder.aggregate([
        {
          $match: {
            status: { $ne: 'Cancelled' },
            createdAt: { $gte: today }
          }
        },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(result => (result.length > 0 ? result[0].total : 0));

      // Get orders by date for chart
      const customerOrdersByDate = await CustomerOrder.aggregate([
        { $match: dateFilter },
        {
          $group: {
            _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            count: { $sum: 1 },
            revenue: { $sum: '$amount' }
          }
        },
        { $sort: { _id: 1 } }
      ]);

      // Update stats for customer orders
      if (type === 'customer') {
        stats.total = customerTotalOrders;
        stats.today = customerTodayOrders;
        stats.revenue = customerRevenue;
        stats.todayRevenue = customerTodayRevenue;
        stats.avgOrderValue = customerTotalOrders > 0 ? customerRevenue / customerTotalOrders : 0;

        // Process status stats
        customerStatusStats.forEach(item => {
          stats.byStatus[item._id] = item.count;
        });

        // Process payment stats
        customerPaymentStats.forEach(item => {
          stats.byPaymentType[item._id] = item.count;
        });

        // Process date stats
        stats.byDate = customerOrdersByDate.map(item => ({
          date: item._id,
          count: item.count,
          revenue: item.revenue
        }));
      } else {
        // For 'all' type, accumulate customer stats
        stats.total += customerTotalOrders;
        stats.today += customerTodayOrders;
        stats.revenue += customerRevenue;
        stats.todayRevenue += customerTodayRevenue;

        // Process status stats
        customerStatusStats.forEach(item => {
          stats.byStatus[item._id] = (stats.byStatus[item._id] || 0) + item.count;
        });

        // Process payment stats
        customerPaymentStats.forEach(item => {
          stats.byPaymentType[item._id] = (stats.byPaymentType[item._id] || 0) + item.count;
        });

        // For 'all' type, merge seller and customer order dates
        if (stats.sellerOrdersByDate) {
          // Create a map of all dates
          const dateMap = {};

          // Add seller orders
          stats.sellerOrdersByDate.forEach(item => {
            dateMap[item._id] = {
              date: item._id,
              count: item.count,
              revenue: item.revenue
            };
          });

          // Add or merge customer orders
          customerOrdersByDate.forEach(item => {
            if (dateMap[item._id]) {
              dateMap[item._id].count += item.count;
              dateMap[item._id].revenue += item.revenue;
            } else {
              dateMap[item._id] = {
                date: item._id,
                count: item.count,
                revenue: item.revenue
              };
            }
          });

          // Convert map to sorted array
          stats.byDate = Object.values(dateMap).sort((a, b) =>
            new Date(a.date) - new Date(b.date)
          );

          // Remove the temporary property
          delete stats.sellerOrdersByDate;
        }

        // Calculate average order value for all orders
        stats.avgOrderValue = stats.total > 0 ? stats.revenue / stats.total : 0;
      }
    }

    // Calculate additional metrics
    stats.avgOrderValue = parseFloat(stats.avgOrderValue.toFixed(2));

    // Cache the results
    await setCache(cacheKey, stats, CACHE_TTL.STATISTICS);

    res.status(200).json({
      success: true,
      data: stats
    });
  } catch (error) {
    logger.error(`Error in getOrderStats: ${error.message}`);
    next(new AppError('Failed to fetch order statistics', 500));
  }
};

/**
 * Export orders to CSV
 * @route GET /api/admin/orders/export
 * @access Private (Admin only)
 */
export const exportOrders = async (req, res, next) => {
  try {
    const {
      type = 'all',
      status,
      from,
      to,
      paymentType,
      format = 'csv' // 'csv' or 'xlsx'
    } = req.query;

    // Maximum number of orders to export
    const MAX_EXPORT_ORDERS = 1000;

    // Prepare date filter
    let dateFilter = {};
    if (from || to) {
      dateFilter.createdAt = {};
      if (from) dateFilter.createdAt.$gte = new Date(from);
      if (to) dateFilter.createdAt.$lte = new Date(to);
    }

    // Arrays to hold orders
    let sellerOrders = [];
    let customerOrders = [];

    // Fetch seller orders if type is 'seller' or 'all'
    if (type === 'seller' || type === 'all') {
      const sellerQuery = { ...dateFilter };
      if (status) sellerQuery.status = status;
      if (paymentType) sellerQuery['payment.method'] = paymentType;

      sellerOrders = await SellerOrder.find(sellerQuery)
        .sort({ createdAt: -1 })
        .limit(type === 'all' ? MAX_EXPORT_ORDERS / 2 : MAX_EXPORT_ORDERS)
        .lean();
    }

    // Fetch customer orders if type is 'customer' or 'all'
    if (type === 'customer' || type === 'all') {
      const customerQuery = { ...dateFilter };
      if (status) customerQuery.status = status;
      if (paymentType) customerQuery.paymentMethod = paymentType;

      customerOrders = await CustomerOrder.find(customerQuery)
        .sort({ createdAt: -1 })
        .limit(type === 'all' ? MAX_EXPORT_ORDERS / 2 : MAX_EXPORT_ORDERS)
        .lean();
    }

    // Prepare data for export
    let exportData = [];

    // Process seller orders
    sellerOrders.forEach(order => {
      exportData.push({
        Type: 'Seller',
        OrderID: order.orderId,
        AWB: order.awb || '',
        Date: new Date(order.orderDate).toISOString().split('T')[0],
        CustomerName: order.customer?.name || '',
        CustomerPhone: order.customer?.phone || '',
        CustomerEmail: order.customer?.email || '',
        CustomerAddress: order.customer?.address ?
          `${order.customer.address.street}, ${order.customer.address.city}, ${order.customer.address.state} - ${order.customer.address.pincode}` : '',
        ProductName: order.product?.name || '',
        ProductSKU: order.product?.sku || '',
        Quantity: order.product?.quantity || 0,
        UnitPrice: order.product?.price || 0,
        TotalAmount: order.payment?.total || 0,
        PaymentMethod: order.payment?.method || '',
        CODCharge: order.payment?.codCharge || 0,
        ShippingCharge: order.payment?.shippingCharge || 0,
        Weight: order.product?.weight || '',
        Status: order.status,
        Courier: order.courier || '',
        Channel: order.channel || '',
        CreatedAt: order.createdAt ? new Date(order.createdAt).toISOString() : '',
        UpdatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : ''
      });
    });

    // Process customer orders
    customerOrders.forEach(order => {
      exportData.push({
        Type: 'Customer',
        OrderID: '',
        AWB: order.awb || '',
        Date: order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : '',
        CustomerName: order.deliveryAddress?.name || '',
        CustomerPhone: order.deliveryAddress?.phone || '',
        CustomerEmail: '',
        CustomerAddress: order.deliveryAddress ?
          `${order.deliveryAddress.address1}, ${order.deliveryAddress.city}, ${order.deliveryAddress.state} - ${order.deliveryAddress.pincode}` : '',
        ProductName: order.package?.items?.length > 0 ? order.package.items[0].name : '',
        ProductSKU: '',
        Quantity: order.package?.items?.length > 0 ? order.package.items[0].quantity : 0,
        UnitPrice: order.package?.items?.length > 0 ? order.package.items[0].value : 0,
        TotalAmount: order.amount || 0,
        PaymentMethod: order.paymentMethod || '',
        CODCharge: '',
        ShippingCharge: '',
        Weight: order.package?.weight || '',
        Status: order.status,
        Courier: order.courier?.name || '',
        Channel: order.serviceType || '',
        CreatedAt: order.createdAt ? new Date(order.createdAt).toISOString() : '',
        UpdatedAt: order.updatedAt ? new Date(order.updatedAt).toISOString() : ''
      });
    });

    // Generate export filename
    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '');
    let filename = `orders_export_${timestamp}`;

    // Add type to filename if specified
    if (type !== 'all') {
      filename += `_${type}`;
    }

    // Add status to filename if specified
    if (status) {
      filename += `_${status}`;
    }

    // Sort data by date
    exportData.sort((a, b) => new Date(b.Date) - new Date(a.Date));

    // Handle empty data
    if (exportData.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'No orders found matching the criteria'
      });
    }

    // Generate CSV string
    if (format === 'csv') {
      // Add .csv extension
      filename += '.csv';

      // Get headers from first object
      const headers = Object.keys(exportData[0]);

      // Generate CSV content
      let csvContent = headers.join(',') + '\r\n';

      // Add data rows
      exportData.forEach(row => {
        const rowData = headers.map(header => {
          // Handle values with commas by wrapping in quotes
          const value = row[header]?.toString() || '';
          return value.includes(',') ? `"${value}"` : value;
        });
        csvContent += rowData.join(',') + '\r\n';
      });

      // Set headers for file download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

      // Send CSV data
      return res.send(csvContent);
    } else if (format === 'xlsx') {
      try {
        // Import xlsx dynamically
        const XLSX = await import('xlsx');

        // Add .xlsx extension
        filename += '.xlsx';

        // Create worksheet
        const worksheet = XLSX.utils.json_to_sheet(exportData);

        // Create workbook
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Orders');

        // Generate buffer
        const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'buffer' });

        // Set headers for file download
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        // Send Excel data
        return res.send(excelBuffer);
      } catch (xlsxError) {
        logger.error(`Error generating Excel file: ${xlsxError.message}`);

        // Fallback to JSON if Excel generation fails
        filename = filename.replace('.xlsx', '.json');

        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=${filename}`);

        // Send JSON data
        return res.json(exportData);
      }
    } else {
      return next(new AppError(`Unsupported export format: ${format}`, 400));
    }
  } catch (error) {
    logger.error(`Error in exportOrders: ${error.message}`);
    next(new AppError('Failed to export orders', 500));
  }
};
