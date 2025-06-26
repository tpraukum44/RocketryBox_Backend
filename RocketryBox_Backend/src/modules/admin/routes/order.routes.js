import express from 'express';
import { checkAdminPermission } from '../../../middleware/adminPermission.js';
import { protect, restrictTo } from '../../../middleware/auth.js';
import { validate } from '../../../middleware/validator.js';
import * as orderController from '../controllers/order.controller.js';
import * as orderValidator from '../validators/order.validator.js';

const router = express.Router();

// All order routes are protected and restricted to Admin/Manager
router.use(protect);
router.use(restrictTo('Admin', 'Manager'));

// Get all orders - requires ordersShipping permission
router.get('/', checkAdminPermission('ordersShipping'), ...orderValidator.orderQueryValidator, validate, orderController.getOrders);

// Get order statistics - requires ordersShipping permission (MOVED BEFORE /:id to prevent conflict)
router.get('/stats/overview', checkAdminPermission('ordersShipping'), orderController.getOrderStats);

// Get order details by ID - requires ordersShipping permission
router.get('/:id', checkAdminPermission('ordersShipping'), ...orderValidator.orderIdValidator, validate, orderController.getOrderDetails);

// Update order status - requires ordersShipping permission
router.patch('/:id/status', checkAdminPermission('ordersShipping'), ...orderValidator.updateOrderStatusValidator, validate, orderController.updateOrderStatus);

export default router;
