import express from 'express';
import { checkAdminPermission } from '../../../middleware/adminPermission.js';
import { protect, restrictTo } from '../../../middleware/auth.js';
import * as dashboardController from '../controllers/dashboard.controller.js';

const router = express.Router();

// All dashboard routes are protected and restricted to Admin/Manager
router.use(protect);
router.use(restrictTo('Admin', 'Manager'));

// Dashboard overview - requires dashboardAccess permission
router.get('/overview', checkAdminPermission('dashboardAccess'), dashboardController.getDashboardOverview);

// Recent orders with seller names
router.get('/recent-orders', dashboardController.getRecentOrders);

// KPI data route
router.get('/kpi', dashboardController.getKPI);

// Customer dashboard data route
router.get('/customers', dashboardController.getCustomerDashboard);

// Seller dashboard data route
router.get('/sellers', dashboardController.getSellerDashboard);

// Shipments data route
router.get('/shipments', dashboardController.getShipments);

// Real-time dashboard updates - requires dashboardAccess permission
router.get('/realtime', checkAdminPermission('dashboardAccess'), dashboardController.getRealtimeData);

export default router;
