import { logger } from '../../../utils/logger.js';
import Customer from '../models/customer.model.js';
import Order from '../models/order.model.js';
import { 
  getCache, 
  setCache, 
  CACHE_KEYS,
  CACHE_TTL,
  invalidateCachePattern,
  CACHE_PATTERNS
} from '../../../utils/cache.js';
import { getIO } from '../../../utils/socketio.js';

/**
 * Get customer profile data with caching
 * @param {string} customerId - Customer ID
 * @returns {Promise<Object>} - Customer profile data
 */
export const getCustomerProfile = async (customerId) => {
  try {
    // Try to get from cache first
    const cacheKey = CACHE_KEYS.CUSTOMER_PROFILE(customerId);
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Fetch from database if not in cache
    const customer = await Customer.findById(customerId).lean();
    
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    // Prepare profile data
    const profileData = {
      id: customer._id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      preferences: customer.preferences,
      isEmailVerified: customer.isEmailVerified,
      isPhoneVerified: customer.isPhoneVerified,
      status: customer.status,
      addressCount: customer.addresses?.length || 0,
      addresses: customer.addresses,
      wishlistCount: customer.wishlist?.length || 0,
      dateOfBirth: customer.dateOfBirth,
      gender: customer.gender,
      profileImage: customer.profileImage,
      lastLogin: customer.lastLogin,
      lastActive: customer.lastActive,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      profileCompletion: customer.profileCompletion
    };
    
    // Cache the profile data
    await setCache(cacheKey, profileData, CACHE_TTL.PROFILE);
    
    return profileData;
  } catch (error) {
    logger.error(`Error getting customer profile: ${error.message}`);
    throw error;
  }
};

/**
 * Get customer orders with caching
 * @param {string} customerId - Customer ID
 * @param {Object} options - Query options (limit, page, status)
 * @returns {Promise<Object>} - Customer orders data
 */
export const getCustomerOrders = async (customerId, options = {}) => {
  try {
    const { limit = 10, page = 1, status } = options;
    const skip = (page - 1) * limit;
    
    // Generate cache key based on parameters
    const cacheKey = `${CACHE_KEYS.CUSTOMER_ORDERS(customerId)}:${limit}:${page}:${status || 'all'}`;
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Build query
    const query = { customer: customerId };
    if (status) {
      query.status = status;
    }
    
    // Execute aggregation for optimized query
    const [orders, totalCount] = await Promise.all([
      Order.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Order.countDocuments(query)
    ]);
    
    // Calculate statistics
    const orderStatusCounts = await Order.aggregate([
      { $match: { customer: mongoose.Types.ObjectId(customerId) } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $project: { status: '$_id', count: 1, _id: 0 } }
    ]);
    
    // Transform the status counts to an object
    const statusCounts = {};
    orderStatusCounts.forEach(item => {
      statusCounts[item.status] = item.count;
    });
    
    // Prepare response
    const result = {
      orders,
      meta: {
        total: totalCount,
        page,
        limit,
        pages: Math.ceil(totalCount / limit)
      },
      stats: {
        statusCounts,
        totalOrders: totalCount
      }
    };
    
    // Cache the result
    await setCache(cacheKey, result, CACHE_TTL.ORDERS);
    
    return result;
  } catch (error) {
    logger.error(`Error getting customer orders: ${error.message}`);
    throw error;
  }
};

/**
 * Get customer recent orders optimized for dashboard
 * @param {string} customerId - Customer ID
 * @returns {Promise<Array>} - Recent orders
 */
export const getCustomerRecentOrders = async (customerId) => {
  try {
    const cacheKey = CACHE_KEYS.CUSTOMER_RECENT_ORDERS(customerId);
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Get recent orders with optimized projection
    const recentOrders = await Order.find({ customer: customerId })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('awb status estimatedDelivery amount createdAt serviceType tracking')
      .lean();
    
    // Cache the result
    await setCache(cacheKey, recentOrders, CACHE_TTL.ORDERS);
    
    return recentOrders;
  } catch (error) {
    logger.error(`Error getting customer recent orders: ${error.message}`);
    return [];
  }
};

/**
 * Get customer address book with caching
 * @param {string} customerId - Customer ID
 * @returns {Promise<Array>} - Customer addresses
 */
export const getCustomerAddresses = async (customerId) => {
  try {
    const cacheKey = CACHE_KEYS.CUSTOMER_ADDRESS_BOOK(customerId);
    const cachedData = await getCache(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Get addresses from database
    const customer = await Customer.findById(customerId)
      .select('addresses')
      .lean();
    
    if (!customer) {
      throw new Error('Customer not found');
    }
    
    const addresses = customer.addresses || [];
    
    // Cache the result
    await setCache(cacheKey, addresses, CACHE_TTL.PROFILE);
    
    return addresses;
  } catch (error) {
    logger.error(`Error getting customer addresses: ${error.message}`);
    return [];
  }
};

/**
 * Invalidate customer cache when data is updated
 * @param {string} customerId - Customer ID
 * @param {string} section - Optional section to invalidate (profile, orders, addresses)
 */
export const invalidateCustomerCache = async (customerId, section = null) => {
  try {
    if (section) {
      // Invalidate specific section
      switch (section) {
        case 'profile':
          await deleteCache(CACHE_KEYS.CUSTOMER_PROFILE(customerId));
          break;
        case 'orders':
          await invalidateCachePattern(`customer:${customerId}:orders*`);
          await deleteCache(CACHE_KEYS.CUSTOMER_RECENT_ORDERS(customerId));
          break;
        case 'addresses':
          await deleteCache(CACHE_KEYS.CUSTOMER_ADDRESS_BOOK(customerId));
          break;
        default:
          // Do nothing for unknown section
      }
    } else {
      // Invalidate all customer data
      await invalidateCachePattern(CACHE_PATTERNS.SPECIFIC_CUSTOMER(customerId));
    }
  } catch (error) {
    logger.error(`Error invalidating customer cache: ${error.message}`);
  }
};

/**
 * Broadcast customer data update to connected clients
 * @param {string} customerId - Customer ID
 * @param {string} section - Section updated (profile, orders, addresses)
 * @param {Object} data - Optional data to send
 */
export const broadcastCustomerUpdate = async (customerId, section, data = null) => {
  try {
    const io = getIO();
    
    // Generate update data if not provided
    if (!data) {
      switch (section) {
        case 'profile':
          data = await getCustomerProfile(customerId);
          break;
        case 'orders':
          data = await getCustomerRecentOrders(customerId);
          break;
        case 'addresses':
          data = await getCustomerAddresses(customerId);
          break;
        default:
          // Use empty object for unknown section
          data = {};
      }
    }
    
    // Emit to customer-specific room
    io.to(`customer-${customerId}`).emit(`customer:${section}:updated`, {
      section,
      data,
      timestamp: new Date()
    });
    
    logger.debug(`Broadcasted customer ${section} update to customer ${customerId}`);
  } catch (error) {
    logger.error(`Error broadcasting customer update: ${error.message}`);
  }
};

export default {
  getCustomerProfile,
  getCustomerOrders,
  getCustomerRecentOrders,
  getCustomerAddresses,
  invalidateCustomerCache,
  broadcastCustomerUpdate
}; 