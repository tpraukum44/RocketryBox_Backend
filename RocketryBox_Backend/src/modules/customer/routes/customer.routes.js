import express from 'express';
import { protect } from '../../../middleware/auth.js';
import { handleMulterError, upload } from '../../../middleware/fileUpload.js';
import {
  authLimiter,
  defaultLimiter,
  paymentLimiter,
  refundLimiter,
  trackingLimiter
} from '../../../middleware/rateLimiter.js';
import { validationHandler as validateRequest } from '../../../middleware/validator.js';
import { checkAuthStatus, login, logout, register, resetPassword, sendOTP, verifyOTPHandler } from '../controllers/auth.controller.js';
import {
  calculateRates,
  cancelOrder,
  checkPaymentStatus,
  createCustomerShipment,
  createOrder,
  createPayment,
  downloadLabel,
  getOrderById,
  getOrderDetails,
  getOrderHistory,
  getOrderStatusCounts,
  getTrackingInfo,
  refundPayment,
  subscribeTracking,
  verifyOrderPayment
} from '../controllers/order.controller.js';
import PaymentController from '../controllers/payment.controller.js';
import {
  addAddress,
  deleteAddress,
  getProfile,
  getProfileImageUrl,
  updateAddress,
  updateProfile,
  uploadProfileImage
} from '../controllers/profile.controller.js';
import {
  checkAvailability,
  listServices
} from '../controllers/service.controller.js';
import { handleTrackingWebhook } from '../controllers/webhook.controller.js';
import {
  addressSchema,
  loginSchema,
  otpSchema,
  profileUpdateSchema,
  registerSchema,
  resetPasswordSchema,
  verifyOTPSchema
} from '../validators/customer.validator.js';
import {
  calculateRatesSchema,
  createOrderSchema,
  createPaymentSchema,
  refundSchema,
  subscribeTrackingSchema,
  verifyPaymentSchema
} from '../validators/order.validator.js';
import { checkAvailabilitySchema } from '../validators/service.validator.js';

const router = express.Router();

// Apply default rate limiter to all routes
router.use(defaultLimiter);

// Auth routes
router.post('/auth/register', authLimiter, validateRequest([registerSchema]), register);
router.post('/auth/login', authLimiter, validateRequest([loginSchema]), login);
router.post('/auth/otp/send', authLimiter, validateRequest([otpSchema]), sendOTP);
router.post('/auth/otp/verify', authLimiter, validateRequest([verifyOTPSchema]), verifyOTPHandler);
router.post('/auth/reset-password', authLimiter, validateRequest([resetPasswordSchema]), resetPassword);
router.get('/auth/check', checkAuthStatus);

// Public endpoints (no auth required)
router.post('/services/check', validateRequest([checkAvailabilitySchema]), checkAvailability);
router.get('/services', listServices);
router.post('/orders/rates', validateRequest([calculateRatesSchema]), calculateRates);
router.post('/webhook/tracking', handleTrackingWebhook);

// Protected routes
router.use(protect);

// Auth routes (protected)
router.post('/auth/logout', authLimiter, logout);

// Profile routes
router.get('/profile', getProfile);
router.put('/profile', validateRequest([profileUpdateSchema]), updateProfile);
router.post('/profile/image', upload.single('profileImage'), handleMulterError, uploadProfileImage);
router.get('/profile/image-url', getProfileImageUrl);
router.post('/address', validateRequest([addressSchema]), addAddress);
router.put('/address/:id', validateRequest([addressSchema]), updateAddress);
router.delete('/address/:id', deleteAddress);

// Order routes
router.post('/orders', validateRequest([createOrderSchema]), createOrder);
router.get('/orders/status-counts', getOrderStatusCounts);
router.get('/orders', getOrderHistory);
router.get('/orders/:orderId', getOrderById);
router.post('/orders/:orderId/cancel', cancelOrder);
router.get('/orders/awb/:awb', getOrderDetails);
router.get('/orders/awb/:awb/label', downloadLabel);

// Manual shipment creation (for admin use or fallback)
router.post('/orders/:orderId/create-shipment', createCustomerShipment);

// Payment routes (Razorpay integration)
router.post('/payments/create-order', paymentLimiter, PaymentController.createPaymentOrder);
router.post('/payments/verify', paymentLimiter, PaymentController.verifyPayment);
router.get('/payments/history', paymentLimiter, PaymentController.getCustomerPayments);
router.get('/payments/:paymentId', paymentLimiter, PaymentController.getPayment);

// Legacy payment routes (keep for backward compatibility)
router.post('/payments', paymentLimiter, validateRequest([createPaymentSchema]), createPayment);
router.post('/payments/verify-order', paymentLimiter, validateRequest([verifyPaymentSchema]), verifyOrderPayment);
router.get('/payments/status/:paymentId', paymentLimiter, checkPaymentStatus);

// Tracking routes
router.post('/tracking/subscribe', trackingLimiter, validateRequest([subscribeTrackingSchema]), subscribeTracking);
router.get('/orders/awb/:awb/tracking', trackingLimiter, getTrackingInfo);

// Refund routes
router.post('/refunds', refundLimiter, validateRequest([refundSchema]), refundPayment);

export default router;
