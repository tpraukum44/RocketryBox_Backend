import express from 'express';
import * as otpController from '../controllers/otp.controller.js';
import { logger } from '../../../utils/logger.js';
import { authLimiter } from '../../../middleware/rateLimiter.js';

const router = express.Router();

// Debug middleware to log OTP requests
router.use((req, res, next) => {
    logger.info('OTP route request:', {
        method: req.method,
        path: req.path,
        originalUrl: req.originalUrl,
        baseUrl: req.baseUrl,
        body: req.body,
        query: req.query,
        headers: req.headers
    });
    next();
});

// Test route
router.get('/test', (req, res) => {
    res.json({ message: 'OTP routes are working!' });
});

// Public OTP routes (no authentication required)
router.post('/send-mobile-otp', authLimiter, otpController.sendMobileOTP);
router.post('/send-email-otp', authLimiter, otpController.sendEmailOTP);
router.post('/verify-mobile-otp', authLimiter, otpController.verifyMobileOTP);
router.post('/verify-email-otp', authLimiter, otpController.verifyEmailOTP);

export default router; 