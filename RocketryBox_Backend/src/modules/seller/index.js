import express from 'express';
import agreementRoutes from './routes/agreement.routes.js';
import bulkOrdersRoutes from './routes/bulkOrders.routes.js';
import codRemittanceRoutes from './routes/codRemittance.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import debugRoutes from './routes/debug.routes.js';
import invoiceRoutes from './routes/invoice.routes.js';
import ledgerRoutes from './routes/ledger.routes.js';
import ndrRoutes from './routes/ndr.routes.js';
import orderRoutes from './routes/order.routes.js';
import productRoutes from './routes/product.routes.js';
import rateCardRoutes from './routes/ratecard.routes.js';
import sellerRoutes from './routes/seller.routes.js';
import serviceCheckRoutes from './routes/serviceCheck.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import shipmentRoutes from './routes/shipment.routes.js';
import shopifyRoutes from './routes/shopify.routes.js';
import storeRoutes from './routes/store.routes.js';
import supportRoutes from './routes/support.routes.js';
import teamUserRoutes from './routes/teamUser.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import warehouseRoutes from './routes/warehouse.routes.js';
import weightDisputeRoutes from './routes/weightDispute.routes.js';

// Import authentication middleware

// Import authentication middleware
import { authenticateSeller } from '../../middleware/auth.js';

// Import document requirement middleware
import {
  progressiveDocumentAccess,
  requireBasicProfile,
  requireDocumentUpload
} from '../../middleware/documentVerification.js';

const router = express.Router();

// Auth and basic seller routes (always accessible for profile/document management)
router.use('/', sellerRoutes);

// Debug routes (for troubleshooting authentication issues - accessible without auth)
router.use('/debug', debugRoutes);

// Support (always accessible)
router.use('/support', supportRoutes);

// Agreements (always accessible)
router.use('/agreements', agreementRoutes);

// Shopify Integration (OAuth callback accessible without auth, status/disconnect require auth)
router.use('/shopify', shopifyRoutes);

// ==============================================================================
// PROGRESSIVE ACCESS ROUTES (Require authentication + basic profile completion)
// ==============================================================================

// Dashboard - Require authentication, basic profile completion (50% document completion)
router.use('/dashboard', authenticateSeller, requireBasicProfile, progressiveDocumentAccess(50), dashboardRoutes);

// Settings - Require authentication + basic profile completion
router.use('/settings', authenticateSeller, requireBasicProfile, settingsRoutes);

// Warehouse and service checks - Basic tools, require authentication + profile completion
router.use('/warehouse', authenticateSeller, requireBasicProfile, warehouseRoutes);
router.use('/service-check', authenticateSeller, requireBasicProfile, serviceCheckRoutes);

// ==============================================================================
// CRITICAL BUSINESS OPERATIONS (Require authentication + 100% document upload)
// ==============================================================================

// Order management - REQUIRES AUTHENTICATION + ALL DOCUMENTS
router.use('/orders', authenticateSeller, requireDocumentUpload, orderRoutes);

// Shipment management - REQUIRES AUTHENTICATION + ALL DOCUMENTS
router.use('/shipments', authenticateSeller, requireDocumentUpload, shipmentRoutes);

// Bulk Orders - REQUIRES AUTHENTICATION + ALL DOCUMENTS
router.use('/bulk-orders', authenticateSeller, requireDocumentUpload, bulkOrdersRoutes);

// Financial management - REQUIRES AUTHENTICATION + BASIC PROFILE (Progressive access for wallet)
router.use('/wallet', authenticateSeller, requireBasicProfile, walletRoutes);
router.use('/invoices', authenticateSeller, requireDocumentUpload, invoiceRoutes);
router.use('/ledger', authenticateSeller, requireDocumentUpload, ledgerRoutes);
router.use('/cod', authenticateSeller, requireDocumentUpload, codRemittanceRoutes);

// Rate Card management - REQUIRES AUTHENTICATION + ALL DOCUMENTS
router.use('/rate-card', authenticateSeller, requireDocumentUpload, rateCardRoutes);

// Business operations - REQUIRES AUTHENTICATION + ALL DOCUMENTS
router.use('/ndr', authenticateSeller, requireDocumentUpload, ndrRoutes);
router.use('/weight-disputes', authenticateSeller, requireDocumentUpload, weightDisputeRoutes);

// Store and product management - REQUIRES AUTHENTICATION + ALL DOCUMENTS
router.use('/stores', authenticateSeller, requireDocumentUpload, storeRoutes);
router.use('/products', authenticateSeller, requireDocumentUpload, productRoutes);

// Team Management - REQUIRES AUTHENTICATION + ALL DOCUMENTS
router.use('/team', authenticateSeller, requireDocumentUpload, teamUserRoutes);

export default router;
