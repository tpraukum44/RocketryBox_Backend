import express from 'express';
import {
  getWalletTransactions,
  getWalletTransactionById,
  addWalletTransaction,
  exportWalletTransactions
} from '../controllers/wallet.controller.js';
import {
  getInvoices,
  getInvoiceById,
  createInvoice,
  updateInvoiceStatus,
  exportInvoices
} from '../controllers/invoice.controller.js';
import {
  getShippingCharges,
  getShippingChargeById,
  createShippingCharge,
  updateShippingChargeStatus,
  exportShippingCharges
} from '../controllers/shippingCharge.controller.js';
import {
  validateGetWalletTransactions,
  validateAddWalletTransaction,
  validateGetInvoices,
  validateCreateInvoice,
  validateUpdateInvoiceStatus
} from '../validators/billing.validator.js';
import {
  validateGetShippingCharges,
  validateCreateShippingCharge,
  validateUpdateShippingChargeStatus
} from '../validators/shipping.validator.js';
import { protect } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';

const router = express.Router();

// Wallet History Routes
router.get(
  '/wallet-history',
  protect,
  checkPermission('billing'),
  validateGetWalletTransactions,
  getWalletTransactions
);

router.get(
  '/wallet-history/export',
  protect,
  checkPermission('billing'),
  validateGetWalletTransactions,
  exportWalletTransactions
);

router.get(
  '/wallet-history/:transactionId',
  protect,
  checkPermission('billing'),
  getWalletTransactionById
);

router.post(
  '/wallet-history',
  protect,
  checkPermission('billing'),
  validateAddWalletTransaction,
  addWalletTransaction
);

// Invoice Routes
router.get(
  '/invoices',
  protect,
  checkPermission('billing'),
  validateGetInvoices,
  getInvoices
);

router.get(
  '/invoices/export',
  protect,
  checkPermission('billing'),
  validateGetInvoices,
  exportInvoices
);

router.get(
  '/invoices/:invoiceId',
  protect,
  checkPermission('billing'),
  getInvoiceById
);

router.post(
  '/invoices',
  protect,
  checkPermission('billing'),
  validateCreateInvoice,
  createInvoice
);

router.patch(
  '/invoices/:invoiceId/status',
  protect,
  checkPermission('billing'),
  validateUpdateInvoiceStatus,
  updateInvoiceStatus
);

// Shipping Charges Routes
router.get(
  '/shipping-charges',
  protect,
  checkPermission('billing'),
  validateGetShippingCharges,
  getShippingCharges
);

router.get(
  '/shipping-charges/export',
  protect,
  checkPermission('billing'),
  validateGetShippingCharges,
  exportShippingCharges
);

router.get(
  '/shipping-charges/:id',
  protect,
  checkPermission('billing'),
  getShippingChargeById
);

router.post(
  '/shipping-charges',
  protect,
  checkPermission('billing'),
  validateCreateShippingCharge,
  createShippingCharge
);

router.patch(
  '/shipping-charges/:id/status',
  protect,
  checkPermission('billing'),
  validateUpdateShippingChargeStatus,
  updateShippingChargeStatus
);

export default router; 