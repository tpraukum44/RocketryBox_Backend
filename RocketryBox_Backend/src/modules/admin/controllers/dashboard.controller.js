import mongoose from 'mongoose';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import Customer from '../../customer/models/customer.model.js';
import Order from '../../order/models/order.model.js';
import Seller from '../../seller/models/seller.model.js';
import WeightDispute from '../../seller/models/weightDispute.model.js';
import Ticket from '../../support/models/ticket.model.js';
import Session from '../models/session.model.js';
import { getRealtimeDashboardData } from '../services/realtime.service.js';

/**
 * Get dashboard overview statistics
 * @route GET /api/v2/admin/dashboard/overview
 * @access Private (Admin only)
 */
export const getDashboardOverview = async (req, res, next) => {
  try {
    // Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get user statistics
    const [
      totalUsers,
      totalSellers,
      totalCustomers,
      newTodayUsers,
      activeTodaySessions
    ] = await Promise.all([
      // Total users (sellers + customers)
      Promise.all([
        Seller.countDocuments(),
        Customer.countDocuments()
      ]).then(counts => counts.reduce((acc, count) => acc + count, 0)),

      // Total sellers
      Seller.countDocuments(),

      // Total customers
      Customer.countDocuments(),

      // New users today
      Promise.all([
        Seller.countDocuments({ createdAt: { $gte: today } }),
        Customer.countDocuments({ createdAt: { $gte: today } })
      ]).then(counts => counts.reduce((acc, count) => acc + count, 0)),

      // Active users today (based on sessions)
      Session.countDocuments({
        isActive: true,
        lastActive: { $gte: today }
      })
    ]);

    // Get order statistics
    const [
      totalOrders,
      pendingOrders,
      processingOrders,
      shippedOrders,
      deliveredOrders,
      cancelledOrders,
      todayOrders
    ] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: 'Pending' }),
      Order.countDocuments({ status: 'Processing' }),
      Order.countDocuments({ status: 'Shipped' }),
      Order.countDocuments({ status: 'Delivered' }),
      Order.countDocuments({ status: 'Cancelled' }),
      Order.countDocuments({ createdAt: { $gte: today } })
    ]);

    // Get revenue statistics
    const [totalRevenue, todayRevenue] = await Promise.all([
      Order.aggregate([
        { $match: { status: { $ne: 'Cancelled' } } },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).then(result => (result.length > 0 ? result[0].total : 0)),

      Order.aggregate([
        {
          $match: {
            status: { $ne: 'Cancelled' },
            createdAt: { $gte: today }
          }
        },
        { $group: { _id: null, total: { $sum: '$totalAmount' } } }
      ]).then(result => (result.length > 0 ? result[0].total : 0))
    ]);

    // Calculate revenue growth (compare with yesterday)
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayRevenue = await Order.aggregate([
      {
        $match: {
          status: { $ne: 'Cancelled' },
          createdAt: {
            $gte: yesterday,
            $lt: today
          }
        }
      },
      { $group: { _id: null, total: { $sum: '$totalAmount' } } }
    ]).then(result => (result.length > 0 ? result[0].total : 0));

    const revenueGrowth = yesterdayRevenue > 0
      ? ((todayRevenue - yesterdayRevenue) / yesterdayRevenue * 100).toFixed(2)
      : 0;

    // Get shipment statistics from actual shipment collections only
    let totalShipments = 0;
    let inTransitShipments = 0;
    let deliveredShipments = 0;
    let returnedShipments = 0;
    let todayShipments = 0;

    try {
      // Check for real shipments in sellershipments collection
      const shipmentsFromDB = await mongoose.connection.db.collection('sellershipments').find().toArray();

      totalShipments = shipmentsFromDB.length;
      inTransitShipments = shipmentsFromDB.filter(s => s.status === 'In Transit' || s.status === 'In-transit').length;
      deliveredShipments = shipmentsFromDB.filter(s => s.status === 'Delivered').length;
      returnedShipments = shipmentsFromDB.filter(s => s.status === 'Returned').length;
      todayShipments = shipmentsFromDB.filter(s => {
        const shipmentDate = s.createdAt ? new Date(s.createdAt) : null;
        return shipmentDate && shipmentDate >= today;
      }).length;
    } catch (shipmentError) {
      console.log('No actual shipments found - showing 0 shipments (not counting orders as shipments)');
      // Keep all shipment counts as 0 - do not use orders as shipments
    }

    // Get support statistics
    const [
      totalDisputes,
      openDisputes,
      resolvedDisputes,
      totalTickets,
      openTickets,
      closedTickets
    ] = await Promise.all([
      WeightDispute.countDocuments(),
      WeightDispute.countDocuments({ status: 'Open' }),
      WeightDispute.countDocuments({ status: 'Resolved' }),
      Ticket.countDocuments(),
      Ticket.countDocuments({ status: { $in: ['New', 'In Progress'] } }),
      Ticket.countDocuments({ status: { $in: ['Resolved', 'Closed'] } })
    ]);

    // Assemble response
    const overview = {
      users: {
        total: totalUsers,
        sellers: totalSellers,
        customers: totalCustomers,
        newToday: newTodayUsers,
        activeToday: activeTodaySessions
      },
      orders: {
        total: totalOrders,
        pending: pendingOrders,
        processing: processingOrders,
        shipped: shippedOrders,
        delivered: deliveredOrders,
        cancelled: cancelledOrders,
        todayCount: todayOrders
      },
      revenue: {
        total: totalRevenue,
        today: todayRevenue,
        growth: revenueGrowth
      },
      shipments: {
        total: totalShipments,
        inTransit: inTransitShipments,
        delivered: deliveredShipments,
        returned: returnedShipments,
        todayCount: todayShipments
      },
      disputes: {
        total: totalDisputes,
        open: openDisputes,
        resolved: resolvedDisputes
      },
      tickets: {
        total: totalTickets,
        open: openTickets,
        closed: closedTickets
      }
    };

    // Broadcast dashboard update to other admins when overview is fetched (manual refresh)
    try {
      const { broadcastDashboardUpdates } = await import('../services/realtime.service.js');
      setTimeout(() => {
        broadcastDashboardUpdates();
      }, 100); // Small delay to ensure response is sent first

      logger.info('📊 Dashboard overview refreshed - broadcasting update to other admins');
    } catch (broadcastError) {
      logger.error(`Error broadcasting overview update: ${broadcastError.message}`);
      // Don't fail the request if broadcast fails
    }

    res.status(200).json({
      success: true,
      data: overview
    });
  } catch (error) {
    logger.error(`Error in getDashboardOverview: ${error.message}`);
    next(new AppError('Failed to fetch dashboard overview', 500));
  }
};

/**
 * Get KPI data for dashboard
 * @route GET /api/v2/admin/dashboard/kpi
 * @access Private (Admin only)
 */
export const getKPI = async (req, res, next) => {
  try {
    // Basic KPI data
    const kpiData = {
      averageOrderValue: 0,
      orderCompletionRate: 0,
      returnRate: 0,
      averageDeliveryTime: 0,
      userAcquisitionCost: 0,
      revenueGrowth: 0,
      activeSellers: 0,
      topPerformingSellers: [],
      topCouriers: []
    };

    res.status(200).json({
      success: true,
      data: kpiData
    });
  } catch (error) {
    logger.error(`Error in getKPI: ${error.message}`);
    next(new AppError('Failed to fetch KPI data', 500));
  }
};

/**
 * Get real-time dashboard data
 * @route GET /api/v2/admin/dashboard/realtime
 * @access Private (Admin only)
 */
export const getRealtimeData = async (req, res, next) => {
  try {
    // Get fresh dashboard data (this will also cache it)
    const dashboardData = await getRealtimeDashboardData();

    // Broadcast update to other connected admins (manual refresh trigger)
    try {
      const { broadcastDashboardUpdates } = await import('../services/realtime.service.js');
      // Broadcast to other admins when one admin refreshes
      setTimeout(() => {
        broadcastDashboardUpdates();
      }, 100); // Small delay to ensure response is sent first

      logger.info('📊 Dashboard manually refreshed - broadcasting update to other admins');
    } catch (broadcastError) {
      logger.error(`Error broadcasting dashboard update: ${broadcastError.message}`);
      // Don't fail the request if broadcast fails
    }

    res.status(200).json({
      success: true,
      data: dashboardData
    });
  } catch (error) {
    logger.error(`Error in getRealtimeData: ${error.message}`);
    next(new AppError('Failed to fetch real-time dashboard data', 500));
  }
};

/**
 * Get customer dashboard data
 * @route GET /api/v2/admin/dashboard/customers
 * @access Private (Admin only)
 */
export const getCustomerDashboard = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Build date filter if provided
    const dateFilter = {};
    if (from || to) {
      const startDate = from ? new Date(from) : new Date(0);
      const endDate = to ? new Date(to) : new Date();
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Get real customer data from customers collection
    const [customers, totalCustomers, activeCustomers, newCustomers] = await Promise.all([
      mongoose.connection.db.collection('customers').find(dateFilter).limit(50).sort({ createdAt: -1 }).toArray(),
      mongoose.connection.db.collection('customers').countDocuments(),
      mongoose.connection.db.collection('customers').countDocuments({ status: 'active' }),
      mongoose.connection.db.collection('customers').countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);

    console.log('📊 Customer data:', {
      customersFound: customers.length,
      totalCustomers,
      activeCustomers,
      newCustomers
    });

    // Calculate customer retention (simplified - customers who made repeat orders)
    let retention = 92; // Default
    let recentOrders = [];
    let customerActivities = [];
    let transformedCustomers = [];

    try {
      // Get customer orders from customerorders collection (not sellerorders)
      const ordersFromDB = await mongoose.connection.db.collection('customerorders').find().toArray();
      console.log('📊 Customer orders found:', ordersFromDB.length);

      if (ordersFromDB.length > 0) {
        // Calculate retention based on repeat customer orders
        const customersWithOrders = new Set(ordersFromDB.map(o => o.customerId?.toString()).filter(Boolean));
        const repeatCustomers = ordersFromDB
          .reduce((acc, order) => {
            const customerId = order.customerId?.toString();
            if (customerId) {
              acc[customerId] = (acc[customerId] || 0) + 1;
            }
            return acc;
          }, {});

        const repeatCount = Object.values(repeatCustomers).filter(count => count > 1).length;
        retention = customersWithOrders.size > 0 ? Math.round((repeatCount / customersWithOrders.size) * 100) : 92;

        // Create recent orders list (customer orders)
        recentOrders = ordersFromDB
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
          .map(order => ({
            id: order.orderNumber || order._id.toString(),
            customerId: order.customerId?.toString() || order._id.toString(),
            customerName: order.deliveryAddress?.name || order.pickupAddress?.name || 'Unknown Customer',
            date: order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
            amount: `₹${order.totalAmount || order.shippingRate || '0'}`,
            status: order.status === 'delivered' ? 'Delivered' :
              order.status === 'pending' ? 'Processing' :
                order.status === 'shipped' ? 'In Transit' :
                  order.status === 'confirmed' ? 'Processing' :
                    order.status || 'Processing',
            paymentMethod: order.selectedProvider?.serviceType === 'cod' ? 'COD' : 'Prepaid'
          }));

        // Create customer activities based on orders
        customerActivities = ordersFromDB
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 10)
          .map((order, index) => ({
            id: `ACT${String(index + 1).padStart(3, '0')}`,
            customerId: order.customerId?.toString() || order._id.toString(),
            customerName: order.deliveryAddress?.name || order.pickupAddress?.name || 'Unknown Customer',
            activity: 'Order Placed',
            timestamp: order.createdAt ? new Date(order.createdAt).toLocaleString() : new Date().toLocaleString(),
            details: `Order #${order.orderNumber || order._id.toString()}`
          }));

        // Calculate orders and spending per customer
        const customerStats = ordersFromDB.reduce((acc, order) => {
          const customerId = order.customerId?.toString();
          if (customerId) {
            if (!acc[customerId]) {
              acc[customerId] = { orders: 0, totalSpent: 0, lastOrder: null };
            }
            acc[customerId].orders += 1;
            const amount = parseFloat(order.totalAmount || order.shippingRate || '0');
            acc[customerId].totalSpent += amount;

            const orderDate = new Date(order.createdAt);
            if (!acc[customerId].lastOrder || orderDate > acc[customerId].lastOrder) {
              acc[customerId].lastOrder = orderDate;
            }
          }
          return acc;
        }, {});

        // Transform customers to dashboard format with order stats
        transformedCustomers = customers.map(customer => {
          const stats = customerStats[customer._id.toString()];
          return {
            id: customer._id.toString(),
            name: customer.name || 'Unknown Customer',
            email: customer.email || '',
            phone: customer.phone || customer.mobile || '',
            orders: stats?.orders || 0,
            totalSpent: `₹${(stats?.totalSpent || 0).toLocaleString()}`,
            lastOrder: stats?.lastOrder ? stats.lastOrder.toISOString().split('T')[0] : 'Never',
            status: customer.status === 'active' ? 'Active' : customer.status === 'inactive' ? 'Inactive' : 'New'
          };
        });
      } else {
        // No orders found, just transform customer data
        transformedCustomers = customers.map(customer => ({
          id: customer._id.toString(),
          name: customer.name || 'Unknown Customer',
          email: customer.email || '',
          phone: customer.phone || customer.mobile || '',
          orders: 0,
          totalSpent: '₹0',
          lastOrder: 'Never',
          status: customer.status === 'active' ? 'Active' : customer.status === 'inactive' ? 'Inactive' : 'New'
        }));
      }

      console.log('📊 Customer dashboard data processed:', {
        customersTransformed: transformedCustomers.length,
        recentOrders: recentOrders.length,
        customerActivities: customerActivities.length,
        retention: `${retention}%`
      });

    } catch (orderError) {
      console.error('Error processing customer orders:', orderError.message);
      // Return customer data without order information
      transformedCustomers = customers.map(customer => ({
        id: customer._id.toString(),
        name: customer.name || 'Unknown Customer',
        email: customer.email || '',
        phone: customer.phone || customer.mobile || '',
        orders: 0,
        totalSpent: '₹0',
        lastOrder: 'Never',
        status: customer.status === 'active' ? 'Active' : customer.status === 'inactive' ? 'Inactive' : 'New'
      }));
    }

    res.status(200).json({
      success: true,
      data: {
        cards: {
          totalCustomers,
          activeCustomers,
          newCustomers,
          customerRetention: `${retention}%`
        },
        customers: transformedCustomers,
        recentOrders,
        customerActivities
      }
    });

  } catch (error) {
    logger.error(`Error in getCustomerDashboard: ${error.message}`);
    next(new AppError('Failed to fetch customer dashboard data', 500));
  }
};

/**
 * Get seller dashboard data
 * @route GET /api/v2/admin/dashboard/sellers
 * @access Private (Admin only)
 */
export const getSellerDashboard = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Build date filter if provided
    const dateFilter = {};
    if (from || to) {
      const startDate = from ? new Date(from) : new Date(0);
      const endDate = to ? new Date(to) : new Date();
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get seller statistics
    const [sellers, totalSellers, activeSellers, newSellers] = await Promise.all([
      mongoose.connection.db.collection('sellers').find(dateFilter).limit(50).sort({ createdAt: -1 }).toArray(),
      mongoose.connection.db.collection('sellers').countDocuments(),
      mongoose.connection.db.collection('sellers').countDocuments({ status: 'active' }),
      mongoose.connection.db.collection('sellers').countDocuments({
        createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) }
      })
    ]);

    // Get seller orders and revenue from sellerorders collection
    let totalOrders = 0;
    let pendingOrders = 0;
    let totalRevenue = 0;
    let todayOrders = 0;
    let recentOrders = [];
    let transformedSellers = [];

    try {
      const ordersFromDB = await mongoose.connection.db.collection('sellerorders').find().toArray();

      // Calculate order statistics
      totalOrders = ordersFromDB.length;
      pendingOrders = ordersFromDB.filter(order => order.status === 'Created' || order.status === 'Pending').length;
      todayOrders = ordersFromDB.filter(order => {
        const orderDate = new Date(order.createdAt);
        return orderDate >= today;
      }).length;

      // Calculate revenue (convert string totals to numbers)
      totalRevenue = ordersFromDB.reduce((sum, order) => {
        const amount = parseFloat(order.payment?.total || '0');
        return sum + amount;
      }, 0);

      // Create recent orders list (seller perspective)
      recentOrders = ordersFromDB
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)
        .map(order => ({
          id: order.orderId || order._id.toString(),
          sellerId: order.seller || order._id.toString(),
          sellerName: 'Loading...', // Will be populated below with actual seller name
          customerName: order.customer?.name || 'Unknown Customer',
          customerEmail: order.customer?.email || 'unknown@email.com',
          customerId: order.customer?._id || order._id.toString(),
          date: order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
          amount: `₹${order.payment?.total || '0'}`,
          status: order.status === 'Delivered' ? 'Delivered' :
            order.status === 'Created' ? 'Pending' :
              order.status || 'Pending',
          product: order.product?.name || 'Product'
        }));

      // Now lookup actual seller names for recent orders
      const sellerIds = [...new Set(recentOrders.map(order => order.sellerId).filter(Boolean))];

      if (sellerIds.length > 0) {
        try {
          const sellersData = await mongoose.connection.db.collection('sellers')
            .find({ _id: { $in: sellerIds.map(id => new mongoose.Types.ObjectId(id)) } })
            .toArray();

          const sellerMap = {};
          sellersData.forEach(seller => {
            sellerMap[seller._id.toString()] = seller.name || seller.fullName || seller.companyName || 'Unknown Seller';
          });

          // Update recent orders with actual seller names
          recentOrders = recentOrders.map(order => ({
            ...order,
            sellerName: sellerMap[order.sellerId] || 'Unknown Seller'
          }));

          console.log(`📊 Updated ${recentOrders.length} recent orders with seller names`);
        } catch (sellerLookupError) {
          console.error('Error looking up seller names:', sellerLookupError.message);
          // Keep default names if lookup fails
          recentOrders = recentOrders.map(order => ({
            ...order,
            sellerName: 'Unknown Seller'
          }));
        }
      }

      // Calculate orders per seller
      const sellerStats = ordersFromDB.reduce((acc, order) => {
        const sellerId = order.sellerId || 'unknown';
        if (!acc[sellerId]) {
          acc[sellerId] = { orders: 0, totalRevenue: 0, lastOrder: null };
        }
        acc[sellerId].orders += 1;
        const amount = parseFloat(order.payment?.total || '0');
        acc[sellerId].totalRevenue += amount;

        const orderDate = new Date(order.createdAt);
        if (!acc[sellerId].lastOrder || orderDate > acc[sellerId].lastOrder) {
          acc[sellerId].lastOrder = orderDate;
        }
        return acc;
      }, {});

      // Transform sellers to dashboard format
      transformedSellers = sellers.map(seller => ({
        id: seller._id.toString(),
        name: seller.name || seller.fullName || 'Unknown Seller',
        email: seller.email || '',
        phone: seller.phone || '',
        orders: sellerStats[seller._id.toString()]?.orders || 0,
        totalRevenue: `₹${(sellerStats[seller._id.toString()]?.totalRevenue || 0).toLocaleString()}`,
        lastOrder: sellerStats[seller._id.toString()]?.lastOrder ?
          sellerStats[seller._id.toString()].lastOrder.toISOString().split('T')[0] : 'Never',
        status: seller.status === 'active' ? 'Active' : seller.status === 'inactive' ? 'Inactive' : 'Pending'
      }));

    } catch (orderError) {
      console.error('Error processing seller orders:', orderError.message);
      // Transform sellers without order information
      transformedSellers = sellers.map(seller => ({
        id: seller._id.toString(),
        name: seller.name || seller.fullName || 'Unknown Seller',
        email: seller.email || '',
        phone: seller.phone || '',
        orders: 0,
        totalRevenue: '₹0',
        lastOrder: 'Never',
        status: seller.status === 'active' ? 'Active' : seller.status === 'inactive' ? 'Inactive' : 'Pending'
      }));
    }

    // Get shipment data for seller dashboard
    let totalShipments = 0;
    try {
      const shipmentsFromDB = await mongoose.connection.db.collection('sellershipments').find().toArray();
      totalShipments = shipmentsFromDB.length;
    } catch (shipmentError) {
      console.error('Error fetching shipments:', shipmentError.message);
      totalShipments = 0; // Default to 0 if no shipments collection
    }

    res.status(200).json({
      success: true,
      data: {
        cards: {
          totalSellers,
          activeSellers,
          totalOrders,
          pendingOrders,
          totalRevenue: totalRevenue.toFixed(2),
          totalShipments,
          newSellers,
          todayOrders
        },
        sellers: transformedSellers,
        recentOrders,
        shipments: [] // Return empty shipments since we don't want to show orders as shipments
      }
    });
  } catch (error) {
    logger.error(`Error in getSellerDashboard: ${error.message}`);
    next(new AppError('Failed to fetch seller dashboard data', 500));
  }
};

/**
 * Get shipments data for dashboard
 * @route GET /api/v2/admin/dashboard/shipments
 * @access Private (Admin only)
 */
export const getShipments = async (req, res, next) => {
  try {
    const { from, to } = req.query;

    // Build date filter if provided
    const dateFilter = {};
    if (from || to) {
      const startDate = from ? new Date(from) : new Date(0); // Beginning of time if no from date
      const endDate = to ? new Date(to) : new Date(); // Now if no to date
      dateFilter.createdAt = { $gte: startDate, $lte: endDate };
    }

    let shipmentData = [];

    try {
      // Get REAL shipments from sellershipments collection
      const sellerShipmentsFromDB = await mongoose.connection.db.collection('sellershipments')
        .find(dateFilter)
        .sort({ createdAt: -1 })
        .toArray();

      // Transform seller shipments to dashboard format
      const sellerShipmentData = sellerShipmentsFromDB.map(shipment => ({
        orderId: shipment.orderId || shipment._id.toString(),
        date: shipment.createdAt ? new Date(shipment.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        seller: shipment.sellerName || 'Seller',
        product: shipment.productName || 'Product',
        weight: shipment.weight ? `${shipment.weight}kg` : '0kg',
        payment: shipment.paymentMethod || 'COD',
        customer: shipment.customerName || 'Customer',
        carrier: shipment.courier || 'Not Assigned',
        status: shipment.status || 'Created',
        fulfilled: shipment.status === 'Delivered' ? 'Yes' : 'No',
        transactionAmount: shipment.amount ? `₹${shipment.amount}` : (shipment.shippingCharge ? `₹${shipment.shippingCharge}` : '₹0'),
        awb: shipment.awb || 'N/A',
        type: 'Seller Shipment'
      }));

      // Get shipped customer orders and include them as shipments
      const customerOrdersFromDB = await mongoose.connection.db.collection('customerorders')
        .find({
          ...dateFilter,
          status: { $in: ['shipped', 'delivered', 'in_transit', 'out_for_delivery'] },
          awb: { $exists: true }
        })
        .sort({ createdAt: -1 })
        .toArray();

      // Transform customer orders to dashboard format
      const customerShipmentData = customerOrdersFromDB.map(order => ({
        orderId: order.orderNumber || order._id.toString(),
        date: order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
        seller: 'Customer Direct',
        product: 'Package',
        weight: order.packageDetails?.weight ? `${order.packageDetails.weight}kg` : '0kg',
        payment: order.selectedProvider?.serviceType || 'Prepaid',
        customer: order.pickupAddress?.name || order.deliveryAddress?.name || 'Customer',
        carrier: order.courierPartner || 'Not Assigned',
        status: order.status === 'delivered' ? 'Delivered' : (order.status === 'shipped' ? 'In Transit' : order.status),
        fulfilled: order.status === 'delivered' ? 'Yes' : 'No',
        transactionAmount: order.totalAmount ? `₹${order.totalAmount}` : '₹0',
        awb: order.awb || 'N/A',
        type: 'Customer Order'
      }));

      // Combine both types of shipments
      shipmentData = [...sellerShipmentData, ...customerShipmentData];

      // Limit to 100 most recent
      shipmentData = shipmentData
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 100);

      console.log(`📦 Dashboard shipments: Found ${sellerShipmentsFromDB.length} seller shipments + ${customerOrdersFromDB.length} customer shipments = ${shipmentData.length} total shipments`);

    } catch (dbError) {
      console.error('Error fetching shipments from DB:', dbError.message);
      console.log('📦 Database error - returning empty shipment data');
      shipmentData = [];
    }

    res.status(200).json({
      success: true,
      data: shipmentData,
      metadata: {
        total: shipmentData.length,
        sellerShipments: shipmentData.filter(s => s.type === 'Seller Shipment').length,
        customerShipments: shipmentData.filter(s => s.type === 'Customer Order').length
      }
    });
  } catch (error) {
    logger.error(`Error in getShipments: ${error.message}`);
    next(new AppError('Failed to fetch shipments', 500));
  }
};

/**
 * Get recent orders for admin dashboard
 * @route GET /api/v2/admin/dashboard/recent-orders
 * @access Private (Admin only)
 */
export const getRecentOrders = async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Get recent orders from sellerorders collection
    const ordersFromDB = await mongoose.connection.db.collection('sellerorders')
      .find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    if (ordersFromDB.length === 0) {
      return res.status(200).json({
        success: true,
        data: []
      });
    }

    // Transform orders to admin dashboard format
    let recentOrders = ordersFromDB.map(order => ({
      id: order.orderId || order._id.toString(),
      userId: order.seller || order._id.toString(), // This will be the seller ID initially
      name: 'Loading...', // Will be populated with seller name
      date: order.createdAt ? new Date(order.createdAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      status: order.status === 'Delivered' ? 'Completed' :
        order.status === 'Created' ? 'Pending' :
          order.status === 'Shipped' ? 'Active' :
            order.status || 'Pending',
      amount: `₹${order.payment?.total || '0'}`
    }));

    // Lookup actual seller names
    const sellerIds = [...new Set(recentOrders.map(order => order.userId).filter(Boolean))];

    if (sellerIds.length > 0) {
      try {
        const sellersData = await mongoose.connection.db.collection('sellers')
          .find({ _id: { $in: sellerIds.map(id => new mongoose.Types.ObjectId(id)) } })
          .toArray();

        const sellerMap = {};
        sellersData.forEach(seller => {
          sellerMap[seller._id.toString()] = seller.name || seller.fullName || seller.companyName || 'Unknown Seller';
        });

        // Update orders with actual seller names
        recentOrders = recentOrders.map(order => ({
          ...order,
          name: sellerMap[order.userId] || 'Unknown Seller'
        }));

        console.log(`📊 Admin dashboard: Retrieved ${recentOrders.length} recent orders with seller names`);
      } catch (sellerLookupError) {
        console.error('Error looking up seller names for recent orders:', sellerLookupError.message);
        // Keep default names if lookup fails
        recentOrders = recentOrders.map(order => ({
          ...order,
          name: 'Unknown Seller'
        }));
      }
    }

    res.status(200).json({
      success: true,
      data: recentOrders
    });
  } catch (error) {
    logger.error(`Error in getRecentOrders: ${error.message}`);
    next(new AppError('Failed to fetch recent orders', 500));
  }
};
