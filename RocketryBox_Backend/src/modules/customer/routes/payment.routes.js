import express from 'express';
import PaymentController from '../controllers/payment.controller.js';
import { protect } from '../../../middleware/auth.js';

const router = express.Router();

/**
 * Payment Routes
 * All routes require customer authentication
 */

// Apply authentication to all payment routes
router.use(protect);

/**
 * @route   POST /api/customer/payments/create-order
 * @desc    Create Razorpay payment order
 * @access  Private (Customer)
 */
router.post('/create-order', PaymentController.createPaymentOrder);

/**
 * @route   POST /api/customer/payments/verify
 * @desc    Verify payment signature and update status
 * @access  Private (Customer)
 */
router.post('/verify', PaymentController.verifyPayment);

/**
 * @route   GET /api/customer/payments
 * @desc    Get customer's payment history
 * @access  Private (Customer)
 * @query   page, limit, status
 */
router.get('/', PaymentController.getCustomerPayments);

/**
 * @route   GET /api/customer/payments/:paymentId
 * @desc    Get specific payment details
 * @access  Private (Customer)
 */
router.get('/:paymentId', PaymentController.getPayment);

/**
 * @route   POST /api/customer/payments/:paymentId/refund
 * @desc    Create refund for a payment
 * @access  Private (Customer)
 */
router.post('/:paymentId/refund', PaymentController.createRefund);

/**
 * @route   GET /api/customer/payments/stats
 * @desc    Get payment statistics for customer
 * @access  Private (Customer)
 * @query   startDate, endDate
 */
router.get('/stats', PaymentController.getPaymentStats);

/**
 * @route   GET /api/customer/payments/config/razorpay
 * @desc    Get Razorpay configuration for frontend
 * @access  Private (Customer)
 */
router.get('/config/razorpay', PaymentController.getRazorpayConfig);

/**
 * @route   GET /api/customer/payments/health
 * @desc    Health check for payment service
 * @access  Private (Customer)
 */
router.get('/health', PaymentController.healthCheck);

export default router; 