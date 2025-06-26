import mongoose from 'mongoose';
import { logger } from '../../../utils/logger.js';
import Seller from '../models/seller.model.js';
import Order from '../models/order.model.js';
import Product from '../models/product.model.js';
import Shipment from '../models/shipment.model.js';
import WarehouseItem from '../models/warehouseItem.model.js';
import { 
  getCache, 
  setCache,
  deleteCache,
  CACHE_KEYS,
  CACHE_TTL,
  invalidateCachePattern,
  CACHE_PATTERNS
} from '../../../utils/cache.js';
import { getIO } from '../../../utils/socketio.js';

/**
 * Get seller profile data with caching
 * @param {string} sellerId - Seller ID
 * @returns {Promise<Object>} - Seller profile data
 */
export const getSellerProfile = async (sellerId) => {
  try {
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.SELLER_PROFILE(sellerId);
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Fetch from database if not in cache
    const seller = await Seller.findById(sellerId).lean();
    
    if (!seller) {
      throw new Error('Seller not found');
    }
    
    // Prepare profile data with only necessary fields
    const profileData = {
      id: seller._id,
      name: seller.name,
      email: seller.email,
      phone: seller.phone,
      businessName: seller.businessName,
      companyCategory: seller.companyCategory,
      brandName: seller.brandName,
      website: seller.website,
      supportContact: seller.supportContact,
      supportEmail: seller.supportEmail,
      status: seller.status,
      kycVerified: seller.kycVerified,
      walletBalance: seller.walletBalance,
      lastLogin: seller.lastLogin,
      lastActive: seller.lastActive,
      address: seller.address,
      businessDetails: seller.businessDetails,
      profileCompletion: seller.profileCompletion,
      createdAt: seller.createdAt,
      updatedAt: seller.updatedAt
    };
    
    // Cache the profile data
    await setCache(cacheKey, profileData, CACHE_TTL.PROFILE);
    
    return profileData;
  } catch (error) {
    logger.error(`Error getting seller profile: ${error.message}`);
    throw error;
  }
};

/**
 * Get seller dashboard summary with caching
 * @param {string} sellerId - Seller ID
 * @returns {Promise<Object>} - Dashboard summary data
 */
export const getSellerDashboard = async (sellerId) => {
  try {
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.SELLER_DASHBOARD(sellerId);
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Get today's date for filtering
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    // Get yesterday's date
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Get last 30 days date
    const last30Days = new Date(today);
    last30Days.setDate(last30Days.getDate() - 30);
    
    // Execute parallel queries for better performance
    const [
      orderStats,
      productStats,
      inventoryStats,
      shipmentStats
    ] = await Promise.all([
      // Order statistics with aggregation pipeline
      Order.aggregate([
        { $match: { seller: mongoose.Types.ObjectId(sellerId) } },
        { $facet: {
            // Today's orders count
            todayOrders: [
              { $match: { createdAt: { $gte: today } } },
              { $count: 'count' }
            ],
            // Pending orders count
            pendingOrders: [
              { $match: { status: 'Pending' } },
              { $count: 'count' }
            ],
            // Processing orders count
            processingOrders: [
              { $match: { status: 'Processing' } },
              { $count: 'count' }
            ],
            // Order status counts
            statusCounts: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
              { $project: { status: '$_id', count: 1, _id: 0 } }
            ],
            // Recent orders
            recentOrders: [
              { $sort: { createdAt: -1 } },
              { $limit: 5 },
              { $project: {
                  _id: 1,
                  orderId: 1,
                  status: 1,
                  createdAt: 1,
                  customer: '$customer.name',
                  amount: '$payment.total'
                } 
              }
            ]
          }
        }
      ]),
      
      // Product statistics
      Product.aggregate([
        { $match: { seller: mongoose.Types.ObjectId(sellerId) } },
        { $facet: {
            // Total active products
            activeProducts: [
              { $match: { status: 'Active' } },
              { $count: 'count' }
            ],
            // Low stock products
            lowStockProducts: [
              { $match: {
                $expr: {
                  $lte: ['$stock', { $ifNull: ['$inventory.lowStockThreshold', 5] }]
                } 
              }},
              { $count: 'count' }
            ]
          }
        }
      ]),
      
      // Inventory statistics
      WarehouseItem.aggregate([
        { $match: { seller: mongoose.Types.ObjectId(sellerId) } },
        { $facet: {
            // Stock status counts
            stockStatusCounts: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
              { $project: { status: '$_id', count: 1, _id: 0 } }
            ],
            // Total inventory items count
            totalItems: [
              { $count: 'count' }
            ],
            // Low stock items
            lowStockItems: [
              { $match: { status: 'Low Stock' } },
              { $count: 'count' }
            ]
          }
        }
      ]),
      
      // Shipment statistics
      Shipment.aggregate([
        { $match: { seller: mongoose.Types.ObjectId(sellerId) } },
        { $facet: {
            // Shipment status counts
            statusCounts: [
              { $group: { _id: '$status', count: { $sum: 1 } } },
              { $project: { status: '$_id', count: 1, _id: 0 } }
            ],
            // Today's shipments
            todayShipments: [
              { $match: { createdAt: { $gte: today } } },
              { $count: 'count' }
            ],
            // Pending pickup count
            pendingPickup: [
              { $match: { status: 'Pending Pickup' } },
              { $count: 'count' }
            ]
          }
        }
      ])
    ]);
    
    // Process and format the results
    const dashboardData = {
      orders: {
        today: orderStats[0]?.todayOrders[0]?.count || 0,
        pending: orderStats[0]?.pendingOrders[0]?.count || 0,
        processing: orderStats[0]?.processingOrders[0]?.count || 0,
        statusCounts: {},
        recentOrders: orderStats[0]?.recentOrders || []
      },
      products: {
        active: productStats[0]?.activeProducts[0]?.count || 0,
        lowStock: productStats[0]?.lowStockProducts[0]?.count || 0
      },
      inventory: {
        total: inventoryStats[0]?.totalItems[0]?.count || 0,
        lowStock: inventoryStats[0]?.lowStockItems[0]?.count || 0,
        statusCounts: {}
      },
      shipments: {
        today: shipmentStats[0]?.todayShipments[0]?.count || 0,
        pendingPickup: shipmentStats[0]?.pendingPickup[0]?.count || 0,
        statusCounts: {}
      }
    };
    
    // Process status counts
    if (orderStats[0]?.statusCounts) {
      orderStats[0].statusCounts.forEach(item => {
        dashboardData.orders.statusCounts[item.status] = item.count;
      });
    }
    
    if (inventoryStats[0]?.stockStatusCounts) {
      inventoryStats[0].stockStatusCounts.forEach(item => {
        dashboardData.inventory.statusCounts[item.status] = item.count;
      });
    }
    
    if (shipmentStats[0]?.statusCounts) {
      shipmentStats[0].statusCounts.forEach(item => {
        dashboardData.shipments.statusCounts[item.status] = item.count;
      });
    }
    
    // Cache the result with TTL
    await setCache(cacheKey, dashboardData, CACHE_TTL.DASHBOARD);
    
    return dashboardData;
  } catch (error) {
    logger.error(`Error getting seller dashboard: ${error.message}`);
    throw error;
  }
};

/**
 * Get seller orders with caching
 * @param {string} sellerId - Seller ID
 * @param {Object} options - Query options (limit, page, status)
 * @returns {Promise<Object>} - Seller orders data
 */
export const getSellerOrders = async (sellerId, options = {}) => {
  try {
    const { limit = 10, page = 1, status } = options;
    const skip = (page - 1) * limit;
    
    // Generate cache key based on parameters
    const cacheKey = `${CACHE_KEYS.SELLER_ORDERS(sellerId)}:${limit}:${page}:${status || 'all'}`;
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Build query
    const query = { seller: sellerId };
    if (status) {
      query.status = status;
    }
    
    // Execute parallel queries
    const [orders, totalCount] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query)
    ]);
    
    // Prepare response
    const result = {
      orders,
      meta: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    };
    
    // Cache the result
    await setCache(cacheKey, result, CACHE_TTL.ORDERS);
    
    return result;
  } catch (error) {
    logger.error(`Error getting seller orders: ${error.message}`);
    throw error;
  }
};

/**
 * Get seller products with caching
 * @param {string} sellerId - Seller ID
 * @param {Object} options - Query options (limit, page, category, status)
 * @returns {Promise<Object>} - Seller products data
 */
export const getSellerProducts = async (sellerId, options = {}) => {
  try {
    const { limit = 10, page = 1, category, status } = options;
    const skip = (page - 1) * limit;
    
    // Generate cache key based on parameters
    const cacheKey = `${CACHE_KEYS.SELLER_PRODUCTS(sellerId)}:${limit}:${page}:${category || 'all'}:${status || 'all'}`;
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Build query
    const query = { seller: sellerId };
    if (category) {
      query.category = category;
    }
    if (status) {
      query.status = status;
    }
    
    // Execute parallel queries
    const [products, totalCount] = await Promise.all([
      Product.find(query)
        .sort({ lastUpdated: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Product.countDocuments(query)
    ]);
    
    // Prepare response
    const result = {
      products,
      meta: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      }
    };
    
    // Cache the result
    await setCache(cacheKey, result, CACHE_TTL.PRODUCTS);
    
    return result;
  } catch (error) {
    logger.error(`Error getting seller products: ${error.message}`);
    throw error;
  }
};

/**
 * Invalidate seller cache when data is updated
 * @param {string} sellerId - Seller ID
 * @param {string} section - Optional section to invalidate (profile, dashboard, orders, products)
 */
export const invalidateSellerCache = async (sellerId, section = null) => {
  try {
    if (section) {
      // Invalidate specific section
      switch (section) {
        case 'profile':
          await deleteCache(CACHE_KEYS.SELLER_PROFILE(sellerId));
          break;
        case 'dashboard':
          await deleteCache(CACHE_KEYS.SELLER_DASHBOARD(sellerId));
          break;
        case 'orders':
          await invalidateCachePattern(`seller:${sellerId}:orders*`);
          break;
        case 'products':
          await invalidateCachePattern(`seller:${sellerId}:products*`);
          break;
        case 'inventory':
          await deleteCache(CACHE_KEYS.SELLER_INVENTORY(sellerId));
          break;
        default:
          // Do nothing for unknown section
      }
    } else {
      // Invalidate all seller data
      await invalidateCachePattern(CACHE_PATTERNS.SPECIFIC_SELLER(sellerId));
    }
  } catch (error) {
    logger.error(`Error invalidating seller cache: ${error.message}`);
  }
};

/**
 * Broadcast seller data update to connected clients
 * @param {string} sellerId - Seller ID
 * @param {string} section - Section updated (profile, dashboard, orders, products)
 * @param {Object} data - Optional data to send
 */
export const broadcastSellerUpdate = async (sellerId, section, data = null) => {
  try {
    const io = getIO();
    
    // Generate update data if not provided
    if (!data) {
      switch (section) {
        case 'profile':
          data = await getSellerProfile(sellerId);
          break;
        case 'dashboard':
          data = await getSellerDashboard(sellerId);
          break;
        case 'orders':
          data = await getSellerOrders(sellerId, { limit: 5 });
          break;
        case 'products':
          data = await getSellerProducts(sellerId, { limit: 5 });
          break;
        default:
          // Use empty object for unknown section
          data = {};
      }
    }
    
    // Emit to seller-specific room
    io.to(`seller-${sellerId}`).emit(`seller:${section}:updated`, {
      section,
      data,
      timestamp: new Date()
    });
    
    logger.debug(`Broadcasted seller ${section} update to seller ${sellerId}`);
  } catch (error) {
    logger.error(`Error broadcasting seller update: ${error.message}`);
  }
};

export default {
  getSellerProfile,
  getSellerDashboard,
  getSellerOrders,
  getSellerProducts,
  invalidateSellerCache,
  broadcastSellerUpdate
}; 