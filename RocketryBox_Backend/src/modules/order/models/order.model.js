import mongoose from 'mongoose';
import SellerOrder from '../../seller/models/order.model.js';
import CustomerOrder from '../../customer/models/order.model.js';

/**
 * This is a wrapper model that allows querying both seller and customer orders
 * using a unified API. It doesn't create a new collection in the database,
 * but instead proxies methods to the respective models.
 */

const Order = {
  /**
   * Find orders with pagination
   * @param {Object} filter - MongoDB filter
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of orders
   */
  async find(filter = {}, options = {}) {
    const [sellerOrders, customerOrders] = await Promise.all([
      SellerOrder.find(filter, null, options),
      CustomerOrder.find(filter, null, options)
    ]);
    
    return [...sellerOrders, ...customerOrders];
  },
  
  /**
   * Count total number of orders
   * @param {Object} filter - MongoDB filter
   * @returns {Promise<Number>} - Count of orders
   */
  async countDocuments(filter = {}) {
    const [sellerCount, customerCount] = await Promise.all([
      SellerOrder.countDocuments(filter),
      CustomerOrder.countDocuments(filter)
    ]);
    
    return sellerCount + customerCount;
  },
  
  /**
   * Run aggregation pipeline on orders
   * @param {Array} pipeline - MongoDB aggregation pipeline
   * @returns {Promise<Array>} - Aggregation results
   */
  async aggregate(pipeline) {
    const [sellerResults, customerResults] = await Promise.all([
      SellerOrder.aggregate(pipeline),
      CustomerOrder.aggregate(pipeline)
    ]);
    
    // Combine results if they need to be merged (e.g., $group with _id: null)
    if (pipeline.some(stage => stage.$group && stage.$group._id === null)) {
      // Merge the results for total calculations
      return [{
        _id: null,
        total: (sellerResults[0]?.total || 0) + (customerResults[0]?.total || 0),
        count: (sellerResults[0]?.count || 0) + (customerResults[0]?.count || 0),
        avg: ((sellerResults[0]?.avg || 0) + (customerResults[0]?.avg || 0)) / 2
      }];
    }
    
    return [...sellerResults, ...customerResults];
  },
  
  /**
   * Find order by ID
   * @param {String} id - Order ID
   * @returns {Promise<Object>} - Order document
   */
  async findById(id) {
    // Try to find in seller orders first
    const sellerOrder = await SellerOrder.findById(id);
    if (sellerOrder) return sellerOrder;
    
    // If not found, try customer orders
    const customerOrder = await CustomerOrder.findById(id);
    if (customerOrder) return customerOrder;
    
    // Not found in either
    return null;
  },
  
  /**
   * Get the model schemas for reference
   */
  schemas: {
    seller: SellerOrder.schema,
    customer: CustomerOrder.schema
  }
};

export default Order; 