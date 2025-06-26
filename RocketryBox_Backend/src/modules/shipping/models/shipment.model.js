import mongoose from 'mongoose';
import SellerShipment from '../../seller/models/shipment.model.js';

/**
 * This is a proxy model that allows access to shipment data across the application.
 * It doesn't create a new collection but uses the seller shipment model.
 */
const Shipment = {
  /**
   * Count documents matching a filter
   * @param {Object} filter - MongoDB filter
   * @returns {Promise<Number>} - Count of matching documents
   */
  async countDocuments(filter = {}) {
    return await SellerShipment.countDocuments(filter);
  },
  
  /**
   * Find shipments matching a filter
   * @param {Object} filter - MongoDB filter
   * @param {Object} projection - Fields to include/exclude
   * @param {Object} options - Query options
   * @returns {Promise<Array>} - Array of matching shipments
   */
  async find(filter = {}, projection = null, options = {}) {
    return await SellerShipment.find(filter, projection, options);
  },
  
  /**
   * Find a shipment by ID
   * @param {String} id - Shipment ID
   * @returns {Promise<Object>} - Shipment document
   */
  async findById(id) {
    return await SellerShipment.findById(id);
  },
  
  /**
   * Find one shipment matching a filter
   * @param {Object} filter - MongoDB filter
   * @returns {Promise<Object>} - Matching shipment
   */
  async findOne(filter = {}) {
    return await SellerShipment.findOne(filter);
  }
};

export default Shipment; 