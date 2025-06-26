import express from 'express';
import multer from 'multer';
import { authenticateSellerOrTeamUser } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';
import { defaultLimiter } from '../../../middleware/rateLimiter.js';
import {
  addOrderNote,
  bulkUpdateStatus,
  cancelOrder,
  createOrder,
  exportOrders,
  generateImportTemplate,
  getOrder,
  getOrderNotes,
  getOrders,
  getOrderStats,
  getOrderTimeline,
  importOrders,
  updateOrderStatus,
  updateTracking
} from '../controllers/order.controller.js';
import { validateBulkOrderStatus, validateOrderStatus } from '../validators/order.validator.js';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

// All routes are authenticated and rate limited
router.use(authenticateSellerOrTeamUser);
router.use(defaultLimiter);

// Order management routes
router.post('/', checkPermission('New Order'), createOrder);
router.get('/', checkPermission('Order'), getOrders);
router.get('/stats', checkPermission('Order'), getOrderStats);
router.get('/import/template', checkPermission('New Order'), generateImportTemplate);
router.post('/import', checkPermission('New Order'), upload.single('file'), importOrders);
router.post('/export', checkPermission('Order'), exportOrders);
router.post('/bulk-status', checkPermission('Order'), validateBulkOrderStatus, bulkUpdateStatus);

// Individual order routes
router.get('/:id', checkPermission('Order'), getOrder);
router.patch('/:id/status', checkPermission('Order'), validateOrderStatus, updateOrderStatus);
router.patch('/:id/tracking', checkPermission('Order'), updateTracking);
router.post('/:id/cancel', checkPermission('Order'), cancelOrder);

// Order notes and timeline
router.get('/:id/timeline', checkPermission('Order'), getOrderTimeline);
router.get('/:id/notes', checkPermission('Order'), getOrderNotes);
router.post('/:id/notes', checkPermission('Order'), addOrderNote);

export default router;
