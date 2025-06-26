import SellerOrder from '../models/order.model.js';
import SellerShipment from '../models/shipment.model.js';
import SellerProduct from '../models/product.model.js';
import { AppError } from '../../../middleware/errorHandler.js';

export const getDashboardSummary = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Orders
    const totalOrders = await SellerOrder.countDocuments({ seller: sellerId });
    const todayOrders = await SellerOrder.countDocuments({ seller: sellerId, orderDate: { $gte: today } });

    // Shipments
    const totalShipments = await SellerShipment.countDocuments({ seller: sellerId });
    const todayShipments = await SellerShipment.countDocuments({ seller: sellerId, createdAt: { $gte: today } });

    // Delivered
    const totalDelivered = await SellerShipment.countDocuments({ seller: sellerId, status: 'Delivered' });
    const todayDelivered = await SellerShipment.countDocuments({ seller: sellerId, status: 'Delivered', deliveryDate: { $gte: today } });

    // COD
    const codOrders = await SellerOrder.find({ seller: sellerId, 'payment.method': 'COD' });
    const codExpected = codOrders.reduce((sum, o) => sum + (parseFloat(o.payment.amount) || 0), 0);
    const codDue = codOrders.filter(o => o.status !== 'Delivered').reduce((sum, o) => sum + (parseFloat(o.payment.amount) || 0), 0);

    // Revenue
    const prepaidOrders = await SellerOrder.find({ seller: sellerId, 'payment.method': 'Prepaid' });
    const totalRevenue = prepaidOrders.reduce((sum, o) => sum + (parseFloat(o.payment.amount) || 0), 0);
    // For demo, dailyGrowth is random
    const dailyGrowth = Math.round(Math.random() * 1000);

    // NDR (Non-Delivery Report)
    const ndrPending = await SellerShipment.countDocuments({ seller: sellerId, status: 'Exception' });

    // Chart Data
    const orderStatusAgg = await SellerOrder.aggregate([
      { $match: { seller: sellerId } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    const orderStatusDistribution = orderStatusAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});

    // Revenue Trend (last 7 days)
    const revenueTrend = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date();
      day.setDate(day.getDate() - i);
      day.setHours(0, 0, 0, 0);
      const nextDay = new Date(day);
      nextDay.setDate(day.getDate() + 1);
      const dayOrders = await SellerOrder.find({ seller: sellerId, orderDate: { $gte: day, $lt: nextDay }, 'payment.method': 'Prepaid' });
      const value = dayOrders.reduce((sum, o) => sum + (parseFloat(o.payment.amount) || 0), 0);
      revenueTrend.push({ date: day.toISOString().slice(0, 10), value });
    }

    // Monthly Comparison (current vs previous month)
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const prevMonth = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const monthStart = new Date(currentYear, currentMonth, 1);
    const prevMonthStart = new Date(prevYear, prevMonth, 1);
    const prevMonthEnd = new Date(currentYear, currentMonth, 0);
    const currentMonthOrders = await SellerOrder.find({ seller: sellerId, orderDate: { $gte: monthStart } });
    const prevMonthOrders = await SellerOrder.find({ seller: sellerId, orderDate: { $gte: prevMonthStart, $lt: prevMonthEnd } });
    const monthlyComparison = [
      {
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        current: currentMonthOrders.length,
        previous: prevMonthOrders.length
      }
    ];

    // Top Products
    const topProductsAgg = await SellerOrder.aggregate([
      { $match: { seller: sellerId } },
      { $group: {
        _id: '$product.sku',
        name: { $first: '$product.name' },
        quantity: { $sum: '$product.quantity' },
        revenue: { $sum: { $toDouble: '$payment.amount' } }
      } },
      { $sort: { quantity: -1 } },
      { $limit: 5 }
    ]);
    const topProducts = topProductsAgg.map(p => ({
      id: p._id,
      name: p.name,
      quantity: p.quantity,
      revenue: p.revenue
    }));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          orders: { total: totalOrders, todayCount: todayOrders },
          shipments: { total: totalShipments, todayCount: todayShipments },
          delivery: { total: totalDelivered, todayCount: todayDelivered },
          cod: { expected: codExpected, totalDue: codDue },
          revenue: { total: totalRevenue, dailyGrowth },
          ndr: { pending: ndrPending }
        },
        chartData: {
          orderStatusDistribution,
          revenueTrend,
          monthlyComparison
        },
        topProducts
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get dashboard stats - simplified dashboard summary stats
 */
export const getDashboardStats = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Orders
    const totalOrders = await SellerOrder.countDocuments({ seller: sellerId });
    const todayOrders = await SellerOrder.countDocuments({ seller: sellerId, orderDate: { $gte: today } });

    // Shipments
    const totalShipments = await SellerShipment.countDocuments({ seller: sellerId });
    const todayShipments = await SellerShipment.countDocuments({ seller: sellerId, createdAt: { $gte: today } });

    // Delivered
    const totalDelivered = await SellerShipment.countDocuments({ seller: sellerId, status: 'Delivered' });
    const pendingDelivery = await SellerShipment.countDocuments({ 
      seller: sellerId, 
      status: { $in: ['Created', 'Ready for Pickup', 'In Transit'] } 
    });

    // Revenue
    const prepaidOrders = await SellerOrder.find({ seller: sellerId, 'payment.method': 'Prepaid' });
    const totalRevenue = prepaidOrders.reduce((sum, o) => sum + (parseFloat(o.payment.amount) || 0), 0);
    
    // COD
    const codOrders = await SellerOrder.find({ seller: sellerId, 'payment.method': 'COD' });
    const codAmount = codOrders.reduce((sum, o) => sum + (parseFloat(o.payment.amount) || 0), 0);

    // NDR
    const ndrCount = await SellerShipment.countDocuments({ seller: sellerId, status: 'Exception' });

    res.status(200).json({
      success: true,
      data: {
        totalOrders,
        todayOrders,
        totalShipments,
        todayShipments,
        delivered: totalDelivered,
        pendingDelivery,
        totalRevenue,
        codAmount,
        ndrCount
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get chart data for dashboard
 */
export const getChartData = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const timeframe = req.query.timeframe || '1M'; // Default to 1 month
    
    let startDate;
    const endDate = new Date();
    
    // Calculate start date based on timeframe
    switch(timeframe) {
      case '1W':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1M':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3M':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      case '6M':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 6);
        break;
      case '1Y':
        startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }
    
    // Order status distribution
    const orderStatusAgg = await SellerOrder.aggregate([
      { $match: { seller: sellerId, orderDate: { $gte: startDate, $lte: endDate } } },
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    
    const orderStatusDistribution = orderStatusAgg.reduce((acc, cur) => {
      acc[cur._id] = cur.count;
      return acc;
    }, {});
    
    // Revenue trend
    let interval, format, groupBy;
    if (timeframe === '1W') {
      interval = 'day';
      format = '%Y-%m-%d';
      groupBy = { year: { $year: '$orderDate' }, month: { $month: '$orderDate' }, day: { $dayOfMonth: '$orderDate' } };
    } else if (timeframe === '1M') {
      interval = 'day';
      format = '%Y-%m-%d';
      groupBy = { year: { $year: '$orderDate' }, month: { $month: '$orderDate' }, day: { $dayOfMonth: '$orderDate' } };
    } else {
      interval = 'month';
      format = '%Y-%m';
      groupBy = { year: { $year: '$orderDate' }, month: { $month: '$orderDate' } };
    }
    
    const revenueTrendAgg = await SellerOrder.aggregate([
      { $match: { seller: sellerId, orderDate: { $gte: startDate, $lte: endDate } } },
      { $group: { 
          _id: groupBy,
          revenue: { $sum: { $toDouble: '$payment.amount' } },
          orders: { $sum: 1 }
        } 
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);
    
    // Format the result based on the interval
    let revenueTrend = [];
    if (interval === 'day') {
      revenueTrend = revenueTrendAgg.map(item => {
        const date = new Date(item._id.year, item._id.month - 1, item._id.day || 1);
        return {
          date: date.toISOString().slice(0, 10),
          revenue: item.revenue,
          orders: item.orders
        };
      });
    } else {
      revenueTrend = revenueTrendAgg.map(item => {
        const date = new Date(item._id.year, item._id.month - 1, 1);
        return {
          date: date.toISOString().slice(0, 7),
          revenue: item.revenue,
          orders: item.orders
        };
      });
    }
    
    // Payment method breakdown
    const paymentMethodAgg = await SellerOrder.aggregate([
      { $match: { seller: sellerId, orderDate: { $gte: startDate, $lte: endDate } } },
      { $group: { 
          _id: '$payment.method', 
          count: { $sum: 1 },
          amount: { $sum: { $toDouble: '$payment.amount' } }
        } 
      }
    ]);
    
    const paymentMethods = paymentMethodAgg.map(item => ({
      method: item._id,
      count: item.count,
      amount: item.amount
    }));
    
    res.status(200).json({
      success: true,
      data: {
        orderStatusDistribution,
        revenueTrend,
        paymentMethods,
        timeframe
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get courier performance data
 */
export const getCourierPerformance = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const timeframe = req.query.timeframe || '1M'; // Default to 1 month
    
    let startDate;
    const endDate = new Date();
    
    // Calculate start date based on timeframe
    switch(timeframe) {
      case '1W':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1M':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3M':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }
    
    // Courier performance aggregation
    const courierPerformanceAgg = await SellerShipment.aggregate([
      { $match: { seller: sellerId, createdAt: { $gte: startDate, $lte: endDate } } },
      { $group: { 
          _id: '$courier',
          shipments: { $sum: 1 },
          delivered: { $sum: { $cond: [{ $eq: ['$status', 'Delivered'] }, 1, 0] } },
          exceptions: { $sum: { $cond: [{ $eq: ['$status', 'Exception'] }, 1, 0] } },
          inTransit: { $sum: { $cond: [{ $eq: ['$status', 'In Transit'] }, 1, 0] } },
          avgDeliveryTime: { $avg: { $cond: [
            { $and: [
              { $eq: ['$status', 'Delivered'] },
              { $ne: ['$deliveryDate', null] }
            ]}, 
            { $divide: [{ $subtract: ['$deliveryDate', '$pickupDate'] }, 3600000 * 24] }, // Convert ms to days
            null
          ]}}
        } 
      }
    ]);
    
    // Format courier performance data
    const courierPerformance = courierPerformanceAgg.map(item => ({
      courier: item._id,
      shipments: item.shipments,
      delivered: item.delivered,
      exceptions: item.exceptions,
      inTransit: item.inTransit,
      deliveryRate: item.shipments > 0 ? (item.delivered / item.shipments) * 100 : 0,
      exceptionRate: item.shipments > 0 ? (item.exceptions / item.shipments) * 100 : 0,
      avgDeliveryTime: item.avgDeliveryTime ? Math.round(item.avgDeliveryTime * 10) / 10 : null // Round to 1 decimal place
    }));
    
    res.status(200).json({
      success: true,
      data: courierPerformance
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get product performance data
 */
export const getProductPerformance = async (req, res, next) => {
  try {
    const sellerId = req.user.id;
    const timeframe = req.query.timeframe || '1M'; // Default to 1 month
    
    let startDate;
    const endDate = new Date();
    
    // Calculate start date based on timeframe
    switch(timeframe) {
      case '1W':
        startDate = new Date();
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '1M':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case '3M':
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 3);
        break;
      default:
        startDate = new Date();
        startDate.setMonth(startDate.getMonth() - 1);
    }
    
    // Product performance aggregation
    const productPerformanceAgg = await SellerOrder.aggregate([
      { $match: { seller: sellerId, orderDate: { $gte: startDate, $lte: endDate } } },
      { $group: { 
          _id: '$product.sku',
          name: { $first: '$product.name' },
          quantity: { $sum: '$product.quantity' },
          revenue: { $sum: { $toDouble: '$payment.amount' } },
          orders: { $sum: 1 }
        } 
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 }
    ]);
    
    // Format product performance data
    const productPerformance = productPerformanceAgg.map(item => ({
      sku: item._id,
      name: item.name,
      quantity: item.quantity,
      revenue: item.revenue,
      orders: item.orders,
      averageOrderValue: item.orders > 0 ? Math.round((item.revenue / item.orders) * 100) / 100 : 0
    }));
    
    res.status(200).json({
      success: true,
      data: productPerformance
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
}; 