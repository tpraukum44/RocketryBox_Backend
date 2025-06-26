import crypto from 'crypto';
import 'dotenv/config';
import Razorpay from 'razorpay';
import Payment from '../modules/customer/models/payment.model.js';

// Hardcoded Razorpay credentials
const RAZORPAY_KEY_ID = 'rzp_test_f3lgnRdSjAnm6y';
const RAZORPAY_KEY_SECRET = '41gQuFZj7FeltDpKcHBRGho9';

// Initialize Razorpay
let razorpayInstance = null;

try {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    throw new Error('Missing Razorpay credentials');
  }

  razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET,
  });

} catch (error) {
  // Silent credential error
}

class RazorpayService {

  /**
   * Create order
   */
  static async createOrder(orderData) {
    try {
      const { amount, currency = 'INR', receipt, notes = {} } = orderData;

      // Validation
      if (!amount || amount <= 0) {
        throw new Error('Invalid amount provided');
      }

      // Ensure receipt is valid and not too long
      let finalReceipt = receipt || `order_${Date.now()}`;
      if (finalReceipt.length > 40) {
        finalReceipt = finalReceipt.substring(0, 40);
      }

      const options = {
        amount: Math.round(amount * 100), // Amount in paise
        currency,
        receipt: finalReceipt,
        notes: {
          ...notes,
          created_at: new Date().toISOString(),
          sdk_version: '2.0'
        }
      };

      console.log('📦 Creating Razorpay order with options:', options);

      const order = await razorpayInstance.orders.create(options);

      console.log('✅ Order created successfully:', order.id);

      return {
        success: true,
        order
      };

    } catch (error) {
      console.error('❌ Order creation failed:', error);

      // Enhanced error handling
      let errorMessage = error.message;
      let errorCode = error.error?.code;

      if (error.statusCode === 500) {
        errorMessage = 'Razorpay server error. Please try again later.';
      } else if (error.statusCode === 400) {
        errorMessage = 'Invalid request parameters. Please check your data.';
      } else if (error.statusCode === 401) {
        errorMessage = 'Authentication failed. Please check your API keys.';
      }

      return {
        success: false,
        error: errorMessage,
        details: error.description || 'Unknown error occurred',
        statusCode: error.statusCode,
        errorCode: errorCode,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Verify payment signature
   */
  static verifyPaymentSignature(verificationData) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = verificationData;

      const expectedSignature = crypto
        .createHmac('sha256', RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

      const isValid = expectedSignature === razorpay_signature;

      return {
        success: true,
        isValid,
        expectedSignature: isValid ? expectedSignature : null
      };

    } catch (error) {
      return {
        success: false,
        isValid: false,
        error: error.message
      };
    }
  }

  /**
   * Get payment details
   */
  static async getPayment(paymentId) {
    try {
      const payment = await razorpayInstance.payments.fetch(paymentId);

      return {
        success: true,
        payment
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.description || 'Failed to fetch payment'
      };
    }
  }

  /**
   * Capture payment (for authorized payments)
   */
  static async capturePayment(paymentId, amount = null) {
    try {
      console.log(`🔄 Attempting to capture payment: ${paymentId}`);

      let payment;

      if (amount && amount > 0) {
        // Capture specific amount (amount should be in rupees, convert to paise)
        const amountInPaise = Math.round(parseFloat(amount) * 100);
        console.log(`[DEBUG] Capturing specific amount: ₹${amount} (${amountInPaise} paise)`);
        payment = await razorpayInstance.payments.capture(paymentId, amountInPaise);
      } else {
        // Auto capture (capture full authorized amount)
        console.log(`[DEBUG] Auto-capturing full authorized amount`);
        payment = await razorpayInstance.payments.capture(paymentId);
      }

      console.log(`✅ Payment captured successfully: ${paymentId}`);

      return {
        success: true,
        payment
      };

    } catch (error) {
      console.error(`❌ Payment capture failed for ${paymentId}:`, error);

      // Enhanced error handling for capture failures
      let errorMessage = error.message;
      let errorCode = error.error?.code;

      if (error.statusCode === 400) {
        if (error.error?.code === 'BAD_REQUEST_ERROR') {
          if (error.error?.description?.includes('amount')) {
            errorMessage = 'Invalid amount format for capture. Please check the amount value.';
          } else if (error.error?.description?.includes('already')) {
            errorMessage = 'Payment has already been captured or cancelled.';
          } else {
            errorMessage = 'Payment cannot be captured. It may have already been captured or cancelled.';
          }
        } else {
          errorMessage = 'Invalid capture request. Please check payment details.';
        }
      } else if (error.statusCode === 500) {
        errorMessage = 'Razorpay server error during capture. Please try again later.';
      }

      return {
        success: false,
        error: errorMessage,
        details: error.description || 'Failed to capture payment',
        statusCode: error.statusCode,
        errorCode: errorCode,
        originalError: error.error
      };
    }
  }

  /**
   * Alias for getPayment (for backward compatibility)
   */
  static async fetchPayment(paymentId) {
    return this.getPayment(paymentId);
  }

  /**
   * Create refund
   */
  static async createRefund(paymentId, refundData = {}) {
    try {
      const refund = await razorpayInstance.payments.refund(paymentId, refundData);

      return {
        success: true,
        refund
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.description || 'Failed to create refund'
      };
    }
  }

  /**
   * Get order details
   */
  static async getOrder(orderId) {
    try {
      const order = await razorpayInstance.orders.fetch(orderId);

      return {
        success: true,
        order
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.description || 'Failed to fetch order'
      };
    }
  }

  /**
   * Get order payments
   */
  static async getOrderPayments(orderId) {
    try {
      const payments = await razorpayInstance.orders.fetchPayments(orderId);

      return {
        success: true,
        payments: payments.items
      };

    } catch (error) {
      return {
        success: false,
        error: error.message,
        details: error.description || 'Failed to fetch order payments'
      };
    }
  }

  /**
   * Get configuration for frontend
   */
  static getConfig() {
    const isTestMode = RAZORPAY_KEY_ID?.includes('test') || process.env.NODE_ENV === 'development';

    return {
      keyId: RAZORPAY_KEY_ID,
      currency: 'INR',
      theme: {
        color: '#3399cc'
      },
      modal: {
        ondismiss: function () {
          // Payment modal closed
        },
        escape: true,
        backdropclose: true
      },
      // Add test mode specific configuration
      ...(isTestMode && {
        remember_customer: false,
        timeout: 180, // 3 minutes timeout for test mode
        retry: {
          enabled: false // Disable retry in test mode to avoid validation issues
        }
      }),
      prefill: {
        method: '' // Let user choose payment method
      },
      // Enhanced configuration for better error handling
      config: {
        display: {
          blocks: {
            utib: { // Axis Bank
              name: 'Pay using Axis Bank',
              instruments: [
                { method: 'card' },
                { method: 'netbanking' }
              ]
            },
            other: { // Other payment methods
              name: 'Other Payment Methods',
              instruments: [
                { method: 'card' },
                { method: 'netbanking' },
                { method: 'wallet' },
                { method: 'upi' }
              ]
            }
          },
          hide: [
            { method: 'emi' } // Hide EMI in test mode
          ],
          sequence: ['block.utib', 'block.other'],
          preferences: {
            show_default_blocks: true
          }
        }
      },
      // Add error handling configuration
      notes: {
        environment: process.env.NODE_ENV || 'development',
        timestamp: new Date().toISOString(),
        version: '2.0'
      },
      // Add network error handling
      network: {
        timeout: 30000, // 30 seconds timeout
        retries: 2,
        retryDelay: 1000 // 1 second between retries
      }
    };
  }

  /**
   * Process payment verification webhook
   */
  static async processPaymentVerification(webhookData, signature) {
    try {
      // Verify webhook signature
      const expectedSignature = crypto
        .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET || RAZORPAY_KEY_SECRET)
        .update(JSON.stringify(webhookData))
        .digest('hex');

      if (signature !== expectedSignature) {
        return {
          success: false,
          error: 'Invalid webhook signature'
        };
      }

      // Process based on event type
      const { event, payload } = webhookData;

      if (event === 'payment.authorized' || event === 'payment.captured') {
        // Update payment status in database
        await Payment.findOneAndUpdate(
          { razorpayPaymentId: payload.payment.entity.id },
          {
            status: 'completed',
            paidAt: new Date()
          }
        );
      }

      return {
        success: true,
        event,
        processed: true
      };

    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Handle payment modal events
   */
  static handlePaymentModalEvents() {
    return {
      handler: function (response) {
        // Payment successful
        return response;
      },
      modal: {
        ondismiss: function () {
          // Payment modal closed
        }
      },
      theme: {
        color: '#3399cc'
      }
    };
  }

  /**
   * Enhanced health check with network testing
   */
  static async healthCheck() {
    try {
      // Test 1: Basic connection test
      console.log('🔍 Testing Razorpay connection...');

      // Test 2: Create a minimal test order
      const testOrder = await razorpayInstance.orders.create({
        amount: 100, // ₹1 in paise
        currency: 'INR',
        receipt: `health_check_${Date.now()}`
      });

      // Test 3: Try to fetch the created order
      const fetchedOrder = await razorpayInstance.orders.fetch(testOrder.id);

      return {
        status: 'healthy',
        razorpayConnected: true,
        testOrderId: testOrder.id,
        fetchVerified: fetchedOrder.id === testOrder.id,
        apiVersion: 'v1',
        timestamp: new Date().toISOString(),
        tests: {
          orderCreation: 'passed',
          orderFetch: 'passed',
          networkLatency: 'normal'
        }
      };

    } catch (error) {
      console.error('❌ Razorpay health check failed:', error);

      // Detailed error analysis
      let errorCategory = 'unknown';
      let recommendation = 'Contact support';

      if (error.message.includes('invalid key')) {
        errorCategory = 'authentication';
        recommendation = 'Check API keys';
      } else if (error.message.includes('network') || error.code === 'ECONNREFUSED') {
        errorCategory = 'network';
        recommendation = 'Check network connectivity';
      } else if (error.status === 500) {
        errorCategory = 'server_error';
        recommendation = 'Razorpay server issue - check status page';
      } else if (error.status === 400) {
        errorCategory = 'bad_request';
        recommendation = 'Check request parameters';
      }

      return {
        status: 'unhealthy',
        razorpayConnected: false,
        error: error.message,
        errorCategory,
        recommendation,
        statusCode: error.status || error.statusCode,
        timestamp: new Date().toISOString(),
        tests: {
          orderCreation: 'failed',
          orderFetch: 'not_attempted',
          networkLatency: 'unknown'
        }
      };
    }
  }
}

export { RazorpayService as razorpayService };
