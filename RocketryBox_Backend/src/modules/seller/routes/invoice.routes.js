import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import {
  createInvoice,
  updateInvoice,
  deleteInvoice,
  getInvoice,
  listInvoices,
  exportInvoices,
  generatePDF,
  initiateInvoicePayment,
  verifyInvoicePayment
} from '../controllers/invoice.controller.js';
import {
  createInvoiceSchema,
  updateInvoiceSchema,
  paymentVerificationSchema
} from '../validators/invoice.validator.js';

const router = express.Router();

// Apply auth middleware to all routes
router.use(authenticateSeller);

// Invoice CRUD routes
router.post('/', validationHandler(createInvoiceSchema), createInvoice);
router.put('/:id', validationHandler(updateInvoiceSchema), updateInvoice);
router.delete('/:id', deleteInvoice);
router.get('/:id', getInvoice);
router.get('/', listInvoices);
router.get('/export', exportInvoices);

// PDF generation
router.get('/:id/pdf', generatePDF);

// Payment routes
router.post('/:id/payment/initiate', initiateInvoicePayment);
router.post('/:id/payment/verify', validationHandler(paymentVerificationSchema), verifyInvoicePayment);

export default router; 
