import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

/**
 * Webhook Security and Processing Middleware
 */

// Rate limiting for webhook endpoints
export const webhookRateLimit = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many webhook requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for valid webhook sources (optional)
  skip: (req) => {
    // You can whitelist Razorpay IPs here if needed
    const razorpayIPs = [
      // Add Razorpay webhook IP addresses here
      // '52.74.122.222',
      // '52.74.122.223'
    ];
    return razorpayIPs.includes(req.ip);
  }
});

// Slow down repeated requests
export const webhookSlowDown = slowDown({
  windowMs: 1 * 60 * 1000, // 1 minute
  delayAfter: 50, // Allow 50 requests per minute at full speed
  delayMs: 100, // Add 100ms delay per request after delayAfter
  maxDelayMs: 2000, // Maximum delay of 2 seconds
});

// Webhook logging middleware
export const webhookLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log incoming webhook
  console.log('🔔 Webhook Request:', {
    timestamp: new Date().toISOString(),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentType: req.get('Content-Type'),
    contentLength: req.get('Content-Length'),
    signature: req.get('x-razorpay-signature') ? '***present***' : 'missing',
    event: req.body?.event || 'unknown'
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    
    console.log('📤 Webhook Response:', {
      timestamp: new Date().toISOString(),
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      event: req.body?.event || 'unknown',
      success: res.statusCode >= 200 && res.statusCode < 300
    });
    
    originalEnd.call(this, chunk, encoding);
  };

  next();
};

// Webhook security headers
export const webhookSecurity = (req, res, next) => {
  // Set security headers for webhook responses
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': "default-src 'none'",
    'Referrer-Policy': 'no-referrer'
  });

  next();
};

// Webhook error handler
export const webhookErrorHandler = (error, req, res, next) => {
  console.error('❌ Webhook Error:', {
    timestamp: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
    event: req.body?.event || 'unknown',
    paymentId: req.body?.payload?.payment?.entity?.id || 'unknown'
  });

  // Always return 200 for webhooks to prevent retries
  // Unless it's a signature verification error
  if (error.message.includes('signature') || error.message.includes('Invalid')) {
    return res.status(400).json({
      success: false,
      error: 'Invalid webhook request'
    });
  }

  // For all other errors, return 200 to acknowledge receipt
  res.status(200).json({
    success: false,
    error: 'Webhook processing failed',
    message: 'Event acknowledged but processing failed'
  });
};

// Webhook validation middleware
export const validateWebhookPayload = (req, res, next) => {
  try {
    // Check if body exists
    if (!req.body) {
      return res.status(400).json({
        success: false,
        error: 'Empty webhook payload'
      });
    }

    // Check if event exists
    if (!req.body.event) {
      return res.status(400).json({
        success: false,
        error: 'Missing event in webhook payload'
      });
    }

    // Check if payload exists
    if (!req.body.payload) {
      return res.status(400).json({
        success: false,
        error: 'Missing payload in webhook'
      });
    }

    // Check signature header
    const signature = req.get('x-razorpay-signature');
    if (!signature) {
      return res.status(400).json({
        success: false,
        error: 'Missing webhook signature'
      });
    }

    next();
  } catch (error) {
    console.error('❌ Webhook validation error:', error);
    res.status(400).json({
      success: false,
      error: 'Invalid webhook payload format'
    });
  }
};

// Combine all webhook middleware
export const webhookMiddleware = [
  webhookSecurity,
  webhookRateLimit,
  webhookSlowDown,
  webhookLogger,
  validateWebhookPayload
];

export default {
  webhookRateLimit,
  webhookSlowDown,
  webhookLogger,
  webhookSecurity,
  webhookErrorHandler,
  validateWebhookPayload,
  webhookMiddleware
}; 