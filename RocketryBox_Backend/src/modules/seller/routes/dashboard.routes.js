import express from 'express';
import { authenticateSellerOrTeamUser } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';
import { getChartData, getCourierPerformance, getDashboardStats, getDashboardSummary, getProductPerformance } from '../controllers/dashboard.controller.js';

const router = express.Router();

router.use(authenticateSellerOrTeamUser);

// Get dashboard summary (main endpoint with all data)
router.get('/', checkPermission('Dashboard access'), getDashboardSummary);

// Get dashboard stats
router.get('/stats', checkPermission('Dashboard access'), getDashboardStats);

// Get chart data
router.get('/charts', checkPermission('Dashboard access'), getChartData);

// Get courier performance
router.get('/couriers', checkPermission('Dashboard access'), getCourierPerformance);

// Get product performance
router.get('/products', checkPermission('Dashboard access'), getProductPerformance);

// Note: downloadReport function was removed as it doesn't exist in the controller

export default router;
