import express from 'express';
import rateLimit from 'express-rate-limit';
import { protect } from '../../../middleware/auth.js';
import {
  handleBlueDartWebhook,
  handleDelhiveryWebhook,
  handleEcomExpressWebhook,
  handleGenericTrackingWebhook,
  handleManualTrackingUpdate,
  handleXpressBeesWebhook
} from '../controllers/webhook.controller.js';

const router = express.Router();

// Webhook rate limiting
const webhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 webhook requests per windowMs
  message: 'Too many webhook requests from this IP',
  standardHeaders: true,
  legacyHeaders: false,
});

// Manual tracking update rate limiting
const manualUpdateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 50, // Limit each user to 50 manual updates per windowMs
  message: 'Too many manual tracking updates',
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Courier Partner Webhook Routes
 * These endpoints receive real-time tracking updates from courier partners
 */

/**
 * @route POST /api/v2/webhooks/delhivery
 * @desc Delhivery tracking webhook
 * @access Public (verified by signature)
 */
router.post('/delhivery', webhookLimiter, handleDelhiveryWebhook);

/**
 * @route POST /api/v2/webhooks/bluedart
 * @desc BlueDart tracking webhook
 * @access Public (verified by signature)
 */
router.post('/bluedart', webhookLimiter, handleBlueDartWebhook);

/**
 * @route POST /api/v2/webhooks/xpressbees
 * @desc XpressBees tracking webhook
 * @access Public (verified by signature)
 */
router.post('/xpressbees', webhookLimiter, handleXpressBeesWebhook);

/**
 * @route POST /api/v2/webhooks/ecomexpress
 * @desc Ecom Express tracking webhook
 * @access Public (verified by signature)
 */
router.post('/ecomexpress', webhookLimiter, handleEcomExpressWebhook);



/**
 * @route POST /api/v2/webhooks/ekart
 * @desc Ekart tracking webhook (uses generic handler)
 * @access Public (verified by signature)
 */
router.post('/ekart', webhookLimiter, handleGenericTrackingWebhook);

/**
 * @route POST /api/v2/webhooks/generic
 * @desc Generic tracking webhook for testing or unknown couriers
 * @access Public (verified by signature)
 */
router.post('/generic', webhookLimiter, handleGenericTrackingWebhook);

/**
 * @route POST /api/v2/webhooks/tracking
 * @desc Generic tracking webhook (alternative endpoint)
 * @access Public (verified by signature)
 */
router.post('/tracking', webhookLimiter, handleGenericTrackingWebhook);

/**
 * Admin/Internal Routes
 */

/**
 * @route POST /api/v2/webhooks/manual-update
 * @desc Manual tracking update (admin/internal use)
 * @access Private (admin/internal only)
 */
router.post('/manual-update', protect, manualUpdateLimiter, handleManualTrackingUpdate);

/**
 * @route GET /api/v2/webhooks/health
 * @desc Webhook service health check
 * @access Public
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Webhook service is running',
    timestamp: new Date().toISOString(),
    endpoints: {
      delhivery: '/api/v2/webhooks/delhivery',
      bluedart: '/api/v2/webhooks/bluedart',
      xpressbees: '/api/v2/webhooks/xpressbees',
      ecomexpress: '/api/v2/webhooks/ecomexpress',
      ekart: '/api/v2/webhooks/ekart',
      generic: '/api/v2/webhooks/generic',
      tracking: '/api/v2/webhooks/tracking',
      manualUpdate: '/api/v2/webhooks/manual-update (auth required)'
    }
  });
});

/**
 * @route GET /api/v2/webhooks/test
 * @desc Test webhook endpoint for development
 * @access Public (development only)
 */
router.post('/test', (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ error: 'Not found' });
  }

  console.log('🧪 Test webhook received:', {
    headers: req.headers,
    body: req.body,
    timestamp: new Date().toISOString()
  });

  res.status(200).json({
    success: true,
    message: 'Test webhook received successfully',
    receivedData: req.body,
    timestamp: new Date().toISOString()
  });
});

export default router;
