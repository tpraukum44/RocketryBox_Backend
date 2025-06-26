import express from 'express';
import { authenticateSellerOrTeamUser } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';
import {
  addTrackingEvent,
  bookCourierShipment,
  createBulkShipments,
  createShipment,
  getManifest,
  getShipment,
  getShipments,
  getShippingRates,
  getTrackingHistory,
  handleReturn,
  shipOrderWithWalletPayment,
  trackShipmentStatus,
  updateShipmentStatus
} from '../controllers/shipment.controller.js';
import {
  validateAddTrackingEvent,
  validateCourierBooking,
  validateCreateBulkShipments,
  validateCreateShipment,
  validateHandleReturn,
  validateShippingRates,
  validateUpdateShipmentStatus
} from '../validators/shipment.validator.js';

const router = express.Router();

// All routes are authenticated with seller or team user authentication
router.use(authenticateSellerOrTeamUser);

// Shipping rates API
router.post('/rates', checkPermission('Shipments'), validateShippingRates, getShippingRates);

// Book shipment with courier API
router.post('/book', checkPermission('Shipments'), validateCourierBooking, bookCourierShipment);

// Create a shipment manually
router.post('/', checkPermission('Shipments'), validateCreateShipment, createShipment);

// Bulk create shipments
router.post('/bulk', checkPermission('Shipments'), validateCreateBulkShipments, createBulkShipments);

// List/filter/search shipments
router.get('/', checkPermission('Shipments'), getShipments);

// Export manifest
router.get('/manifest', checkPermission('Manifest'), getManifest);

// Get shipment details
router.get('/:id', checkPermission('Shipments'), getShipment);

// Track shipment with courier API
router.get('/:id/track', checkPermission('Shipments'), trackShipmentStatus);

// Update shipment status
router.patch('/:id/status', checkPermission('Shipments'), validateUpdateShipmentStatus, updateShipmentStatus);

// Add tracking event
router.post('/:id/tracking', checkPermission('Shipments'), validateAddTrackingEvent, addTrackingEvent);

// Get tracking history
router.get('/:id/tracking', checkPermission('Shipments'), getTrackingHistory);

// Handle return/NDR
router.post('/:id/return', checkPermission('Shipments'), validateHandleReturn, handleReturn);

// Ship order with rate selection and wallet payment (IDEAL WORKFLOW)
router.post('/ship-with-payment', checkPermission('Shipments'), shipOrderWithWalletPayment);

export default router;
