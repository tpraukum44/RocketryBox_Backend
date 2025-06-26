import express from 'express';
import {
  getReportStats,
  getRevenueData,
  getShipmentData,
  getCustomerData,
  getDashboardKPI,
  exportReport
} from '../controllers/report.controller.js';
import {
  validateReportStats,
  validateRevenueData,
  validateShipmentData,
  validateCustomerData,
  validateDashboardKPI,
  validateExportReport
} from '../validators/report.validator.js';
import { protect } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';

const router = express.Router();

// Get report overview statistics
router.get(
  '/stats',
  protect,
  checkPermission('reportsAnalytics'),
  validateReportStats,
  getReportStats
);

// Get revenue data for charts
router.get(
  '/revenue',
  protect,
  checkPermission('reportsAnalytics'),
  validateRevenueData,
  getRevenueData
);

// Get shipment data for charts
router.get(
  '/shipments',
  protect,
  checkPermission('reportsAnalytics'),
  validateShipmentData,
  getShipmentData
);

// Get customer data for reports
router.get(
  '/customers',
  protect,
  checkPermission('reportsAnalytics'),
  validateCustomerData,
  getCustomerData
);

// Get all KPI data for dashboard
router.get(
  '/kpi',
  protect,
  checkPermission('reportsAnalytics', 'dashboardAccess'),
  validateDashboardKPI,
  getDashboardKPI
);

// Export report data
router.get(
  '/export',
  protect,
  checkPermission('reportsAnalytics'),
  validateExportReport,
  exportReport
);

export default router; 