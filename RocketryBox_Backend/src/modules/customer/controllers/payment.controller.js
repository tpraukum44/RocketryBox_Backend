import crypto from 'crypto';
import 'dotenv/config';
import Razorpay from 'razorpay';
import { AppError } from '../../../middleware/errorHandler.js';
import { OrderBookingService } from '../../../services/orderBooking.service.js';
import { razorpayService } from '../../../services/razorpay.service.js';
import CustomerOrder from '../models/customerOrder.model.js';
import Payment from '../models/payment.model.js';

// Hardcoded Razorpay credentials
const RAZORPAY_KEY_ID = 'rzp_test_f3lgnRdSjAnm6y';
const RAZORPAY_KEY_SECRET = '41gQuFZj7FeltDpKcHBRGho9';

// Create Razorpay instance with error handling
let razorpay;
try {
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    console.warn('Razorpay credentials not properly configured, using mock implementation');
    razorpay = null;
  } else {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
    console.log('Razorpay initialized successfully');
  }
} catch (error) {
  console.error('Failed to initialize Razorpay:', error.message);
  razorpay = null;
}

class PaymentController {
  static async createPaymentOrder(req, res, next) {
    try {
      const { amount, currency = 'INR', orderData } = req.body;
      const customerId = req.user.id;

      if (!orderData || !orderData.pickupAddress || !orderData.deliveryAddress || !orderData.package) {
        return next(new AppError('Incomplete or missing order data provided', 400));
      }

      const tempReceipt = `temp_${Date.now().toString().slice(-8)}_${Math.floor(Math.random() * 1000)}`;

      const razorpayResult = await razorpayService.createOrder({
        amount: amount,
        currency,
        receipt: tempReceipt,
        notes: {
          customerId: customerId.toString(),
          customerEmail: req.user.email,
          pickupPincode: orderData.pickupAddress.address?.pincode,
          deliveryPincode: orderData.deliveryAddress.address?.pincode,
          weight: orderData.package.weight,
          temporaryOrder: 'true'
        }
      });

      if (!razorpayResult.success) {
        return next(new AppError(`Failed to create payment order: ${razorpayResult.error}`, 500));
      }

      const payment = new Payment({
        customerId,
        razorpayOrderId: razorpayResult.order.id,
        amount,
        currency,
        status: 'created',
        metadata: {
          createdAt: new Date(),
          temporaryOrderData: orderData,
          razorpayOrderData: razorpayResult.order
        }
      });

      await payment.save();

      res.status(201).json({
        success: true,
        data: {
          paymentId: payment._id,
          razorpayOrder: razorpayResult.order,
          orderId: razorpayResult.order.id,
          keyId: RAZORPAY_KEY_ID,
          amount,
          currency,
          prefill: {
            name: req.user.name,
            email: req.user.email,
            contact: req.user.phone || req.user.mobile
          }
        }
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  static async verifyPayment(req, res, next) {
    try {
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const customerId = req.user.id;

      console.log('[DEBUG] Payment verification started:', {
        order_id: razorpay_order_id,
        payment_id: razorpay_payment_id,
        customer_id: customerId
      });

      if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return res.status(400).json({
          success: false,
          error: 'MISSING_REQUIRED_FIELDS',
          message: 'Missing required payment verification fields',
        });
      }

      // Verify signature first
      const secret = RAZORPAY_KEY_SECRET;
      if (!secret) {
        console.error('Razorpay secret not set in environment variables');
        return res.status(500).json({
          success: false,
          error: 'SERVER_ERROR',
          message: 'Payment service configuration error',
        });
      }

      const body = razorpay_order_id + '|' + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(body)
        .digest('hex');

      if (expectedSignature !== razorpay_signature) {
        console.warn('Invalid Razorpay signature', { razorpay_order_id, razorpay_payment_id });
        return res.status(400).json({
          success: false,
          error: 'INVALID_SIGNATURE',
          message: 'Payment signature verification failed'
        });
      }

      console.log('[DEBUG] Signature verified successfully');

      // Fetch and potentially capture the payment from Razorpay
      const paymentDetails = await razorpayService.fetchPayment(razorpay_payment_id);

      if (!paymentDetails.success) {
        console.error('Failed to fetch payment details from Razorpay:', paymentDetails.error);
        return res.status(500).json({
          success: false,
          error: 'PAYMENT_FETCH_FAILED',
          message: 'Failed to verify payment with Razorpay'
        });
      }

      let razorpayPayment = paymentDetails.payment;
      console.log('[DEBUG] Payment status from Razorpay:', razorpayPayment.status);

      console.log('[DEBUG] Payment verification and capture completed successfully');

      // Find the payment record first (we need it for the amount)
      const payment = await Payment.findOne({
        razorpayOrderId: razorpay_order_id,
        customerId: customerId
      });

      if (!payment) {
        console.error('Payment record not found:', { razorpay_order_id, customerId });
        return res.status(404).json({
          success: false,
          error: 'PAYMENT_NOT_FOUND',
          message: 'Payment record not found'
        });
      }

      console.log('[DEBUG] Payment record found:', payment._id);

      // Now handle capture with the correct amount from our payment record
      if (razorpayPayment.status === 'authorized') {
        console.log('[DEBUG] Payment is authorized, attempting to capture with amount from payment record...');
        console.log('[DEBUG] Payment amount from our DB:', payment.amount, 'rupees');
        console.log('[DEBUG] Payment amount from Razorpay:', razorpayPayment.amount, 'paise');

        try {
          // Use the amount from our payment record
          const captureResult = await razorpayService.capturePayment(razorpay_payment_id, payment.amount);

          if (captureResult.success) {
            console.log('[DEBUG] Payment captured successfully with DB amount');
            razorpayPayment = captureResult.payment; // Update with captured payment details
          } else {
            console.log('[ERROR] Failed to capture payment:', captureResult.error);
            console.log('[ERROR] Capture error details:', captureResult.details);
            console.log('[ERROR] Original error:', captureResult.originalError);

            return res.status(400).json({
              success: false,
              error: 'PAYMENT_CAPTURE_FAILED',
              message: `Failed to capture payment: ${captureResult.error}`
            });
          }
        } catch (captureError) {
          console.log('[ERROR] Exception during payment capture:', captureError);
          return res.status(500).json({
            success: false,
            error: 'PAYMENT_CAPTURE_ERROR',
            message: `Payment capture failed: ${captureError.message}`
          });
        }
      }

      // Final verification that payment is captured/successful
      if (razorpayPayment.status !== 'captured') {
        console.log(`[ERROR] Payment not captured after capture attempt. Status: ${razorpayPayment.status}`);
        return res.status(400).json({
          success: false,
          error: 'PAYMENT_NOT_CAPTURED',
          message: `Payment not successful. Status: ${razorpayPayment.status}`
        });
      }

      // Check if order already exists (prevent duplicate creation)
      if (payment.orderId) {
        const existingOrder = await CustomerOrder.findById(payment.orderId);
        if (existingOrder) {
          console.log('[DEBUG] Order already exists:', existingOrder.orderNumber);
          return res.status(200).json({
            success: true,
            message: 'Payment already verified',
            data: {
              order: {
                id: existingOrder._id,
                orderNumber: existingOrder.orderNumber,
                awb: existingOrder.awb,
                status: existingOrder.status,
                paymentStatus: existingOrder.paymentStatus
              }
            }
          });
        }
      }

      // Extract temporary order data
      const temporaryOrderData = payment.metadata?.temporaryOrderData;
      if (!temporaryOrderData) {
        console.error('Temporary order data not found in payment metadata');
        return res.status(400).json({
          success: false,
          error: 'INVALID_ORDER_DATA',
          message: 'Order data not found'
        });
      }

      console.log('[DEBUG] Creating customer order from temporary data');

      // CRITICAL FIX: Attempt AWB generation BEFORE creating order
      // If AWB generation fails, order creation should fail completely
      console.log('[DEBUG] Step 1: Attempting AWB generation before order creation...');

      let awbResult = null;
      let courierBookingData = null;

      try {
        // Check if a courier partner is selected
        const selectedProvider = temporaryOrderData.selectedProvider;
        if (selectedProvider && selectedProvider.name && selectedProvider.name !== 'RocketryBox Logistics') {
          console.log('[DEBUG] Attempting AWB generation with:', selectedProvider.name);

          // Prepare shipment data for AWB generation
          const shipmentDataForAwb = {
            orderId: `REF_${Date.now()}`, // Reference ID for AWB generation (not an AWB itself)
            totalAmount: payment.amount,
            packageDetails: {
              weight: temporaryOrderData.package.weight,
              dimensions: temporaryOrderData.package.dimensions,
              declaredValue: temporaryOrderData.package.declaredValue || payment.amount
            },
            instructions: temporaryOrderData.instructions || '',
            pickupDate: temporaryOrderData.pickupDate ? new Date(temporaryOrderData.pickupDate) : new Date(),

            // Pickup address
            pickupAddress: {
              name: temporaryOrderData.pickupAddress.name,
              phone: temporaryOrderData.pickupAddress.phone,
              email: temporaryOrderData.pickupAddress.email || req.user.email,
              address: {
                line1: temporaryOrderData.pickupAddress.address.line1,
                line2: temporaryOrderData.pickupAddress.address.line2 || '',
                city: temporaryOrderData.pickupAddress.address.city,
                state: temporaryOrderData.pickupAddress.address.state,
                pincode: temporaryOrderData.pickupAddress.address.pincode,
                country: temporaryOrderData.pickupAddress.address.country || 'India'
              }
            },

            // Delivery address
            deliveryAddress: {
              name: temporaryOrderData.deliveryAddress.name,
              phone: temporaryOrderData.deliveryAddress.phone,
              email: temporaryOrderData.deliveryAddress.email || req.user.email,
              address: {
                line1: temporaryOrderData.deliveryAddress.address.line1,
                line2: temporaryOrderData.deliveryAddress.address.line2 || '',
                city: temporaryOrderData.deliveryAddress.address.city,
                state: temporaryOrderData.deliveryAddress.address.state,
                pincode: temporaryOrderData.deliveryAddress.address.pincode,
                country: temporaryOrderData.deliveryAddress.address.country || 'India'
              }
            }
          };

          // Attempt AWB generation with OrderBookingService
          awbResult = await OrderBookingService.bookShipmentWithCourier(
            shipmentDataForAwb,
            selectedProvider
          );

          console.log('[DEBUG] AWB generation result:', {
            success: awbResult.success,
            awb: awbResult.awb,
            trackingId: awbResult.trackingId,
            error: awbResult.error
          });

          // 🔍 DETAILED DEBUGGING: Log the complete AWB result object
          console.log('🔍 COMPLETE AWB RESULT OBJECT:');
          console.log('  - awbResult.awb:', awbResult.awb);
          console.log('  - awbResult.trackingId:', awbResult.trackingId);
          console.log('  - awbResult.trackingUrl:', awbResult.trackingUrl);
          console.log('  - Full awbResult:', JSON.stringify(awbResult, null, 2));

          // CRITICAL: If AWB generation fails, fail the entire order creation
          if (!awbResult.success || !awbResult.awb) {
            console.error('[ERROR] AWB generation failed, aborting order creation');

            // Return error response - order should NOT be created
            return res.status(400).json({
              success: false,
              error: 'AWB_GENERATION_FAILED',
              message: `Order creation failed: Unable to generate AWB with ${selectedProvider.name}. Error: ${awbResult.error}`,
              details: {
                courierPartner: selectedProvider.name,
                originalError: awbResult.error,
                recommendation: 'Please try again or contact support if the issue persists.'
              }
            });
          }

          // Store courier booking data for order creation
          courierBookingData = {
            awb: awbResult.awb,
            trackingUrl: awbResult.trackingUrl,
            courierPartner: awbResult.courierPartner || selectedProvider.name,
            bookingType: 'API_AUTOMATED',
            estimatedDelivery: awbResult.estimatedDelivery
          };

          console.log('[SUCCESS] AWB generated successfully:', awbResult.awb);
        } else {
          console.log('[DEBUG] No courier partner selected, using default logistics (no AWB required)');
        }
      } catch (awbError) {
        console.error('[ERROR] AWB generation threw exception:', awbError.message);

        // Return error response - order should NOT be created
        return res.status(400).json({
          success: false,
          error: 'AWB_GENERATION_ERROR',
          message: `Order creation failed: AWB generation error. ${awbError.message}`,
          details: {
            error: awbError.message,
            recommendation: 'Please try again or contact support if the issue persists.'
          }
        });
      }

      console.log('[DEBUG] Step 2: AWB generation completed, proceeding with order creation...');

      // Prepare order data for CustomerOrder creation (only reached if AWB generation succeeded)
      const orderData = {
        customerId: customerId,
        paymentId: payment._id,
        paymentStatus: 'paid',
        status: courierBookingData ? 'shipped' : 'confirmed', // Set to shipped if AWB generated
        packageDetails: {
          weight: temporaryOrderData.package.weight,
          dimensions: {
            length: temporaryOrderData.package.dimensions.length,
            width: temporaryOrderData.package.dimensions.width,
            height: temporaryOrderData.package.dimensions.height
          },
          declaredValue: temporaryOrderData.package.declaredValue || 100
        },
        pickupAddress: {
          name: temporaryOrderData.pickupAddress.name,
          phone: temporaryOrderData.pickupAddress.phone,
          email: temporaryOrderData.pickupAddress.email || req.user.email,
          address: {
            line1: temporaryOrderData.pickupAddress.address.line1,
            line2: temporaryOrderData.pickupAddress.address.line2,
            city: temporaryOrderData.pickupAddress.address.city,
            state: temporaryOrderData.pickupAddress.address.state,
            pincode: temporaryOrderData.pickupAddress.address.pincode,
            country: temporaryOrderData.pickupAddress.address.country || 'India'
          }
        },
        deliveryAddress: {
          name: temporaryOrderData.deliveryAddress.name,
          phone: temporaryOrderData.deliveryAddress.phone,
          email: temporaryOrderData.deliveryAddress.email || req.user.email,
          address: {
            line1: temporaryOrderData.deliveryAddress.address.line1,
            line2: temporaryOrderData.deliveryAddress.address.line2,
            city: temporaryOrderData.deliveryAddress.address.city,
            state: temporaryOrderData.deliveryAddress.address.state,
            pincode: temporaryOrderData.deliveryAddress.address.pincode,
            country: temporaryOrderData.deliveryAddress.address.country || 'India'
          }
        },
        selectedProvider: temporaryOrderData.selectedProvider || {
          id: 'default',
          name: 'RocketryBox Logistics',
          serviceType: 'standard',
          totalRate: payment.amount,
          estimatedDays: '3-5'
        },
        shippingRate: payment.amount,
        totalAmount: payment.amount,
        instructions: temporaryOrderData.instructions || '',
        pickupDate: temporaryOrderData.pickupDate ? new Date(temporaryOrderData.pickupDate) : new Date(),
        paidAt: new Date(),

        // Include AWB data if generated
        awb: courierBookingData?.awb || null,
        trackingId: courierBookingData?.trackingId || null, // Store tracking ID for API operations (NO fallback to AWB)
        trackingUrl: courierBookingData?.trackingUrl || null,
        courierPartner: courierBookingData?.courierPartner || null,
        bookingType: courierBookingData?.bookingType || 'MANUAL_REQUIRED',
        estimatedDelivery: courierBookingData?.estimatedDelivery || null
      };

      // 🔍 DEBUGGING: Log what we're about to store in database
      console.log('🔍 DATABASE STORAGE DEBUG - Values being stored:');
      console.log('  - orderData.awb:', orderData.awb);
      console.log('  - orderData.trackingId:', orderData.trackingId);
      console.log('  - orderData.trackingUrl:', orderData.trackingUrl);
      console.log('  - courierBookingData?.awb:', courierBookingData?.awb);
      console.log('  - courierBookingData?.trackingId:', courierBookingData?.trackingId);

      // Create the customer order (only reached if AWB generation succeeded or no courier required)
      const order = await CustomerOrder.create(orderData);

      // 🔍 DEBUGGING: Log what was actually stored in database
      console.log('🔍 DATABASE STORAGE RESULT - Values actually stored:');
      console.log('  - order.awb:', order.awb);
      console.log('  - order.trackingId:', order.trackingId);
      console.log('  - order.trackingUrl:', order.trackingUrl);

      console.log('[DEBUG] Customer order created successfully:', {
        orderNumber: order.orderNumber,
        awb: order.awb,
        trackingId: order.trackingId,
        status: order.status
      });

      // Update the order ID in the temporary AWB if it was generated
      if (courierBookingData && order.awb) {
        console.log('[DEBUG] Order created with AWB:', order.awb);
      }

      // Update payment record with order reference
      await Payment.findByIdAndUpdate(payment._id, {
        orderId: order._id,
        status: 'completed',
        razorpayPaymentId: razorpay_payment_id,
        paidAt: new Date(),
        metadata: {
          ...payment.metadata,
          verifiedAt: new Date(),
          orderCreated: true,
          orderNumber: order.orderNumber,
          shipmentBooked: !!order.awb // Track if shipment was booked
        }
      });

      console.log('[DEBUG] Payment record updated with order reference');

      // Return success response with order details
      return res.status(200).json({
        success: true,
        message: 'Payment verified and order created successfully',
        data: {
          payment: {
            id: payment._id,
            razorpayPaymentId: razorpay_payment_id,
            status: 'completed'
          },
          order: {
            id: order._id,
            orderNumber: order.orderNumber,
            awb: order.awb,
            status: order.status,
            paymentStatus: order.paymentStatus,
            totalAmount: order.totalAmount,
            courierPartner: order.courierPartner,
            trackingUrl: order.trackingUrl,
            createdAt: order.createdAt
          }
        }
      });

    } catch (error) {
      console.error('Error verifying payment and creating order:', error);
      return res.status(500).json({
        success: false,
        error: 'SERVER_ERROR',
        message: 'Internal server error during payment verification'
      });
    }
  }

  static async getPayment(req, res, next) {
    try {
      const { paymentId } = req.params;
      const customerId = req.user.id;
      const payment = await Payment.findOne({ _id: paymentId, customerId }).populate('orderId');
      if (!payment) return next(new AppError('Payment not found', 404));
      res.json({ success: true, data: { payment } });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  static async getCustomerPayments(req, res, next) {
    try {
      const customerId = req.user.id;
      const { page = 1, limit = 10, status } = req.query;
      const filter = { customerId };
      if (status) filter.status = status;
      const payments = await Payment.find(filter)
        .populate('orderId', 'orderNumber totalAmount status')
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      const total = await Payment.countDocuments(filter);
      res.json({
        success: true,
        data: {
          payments,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / limit)
          }
        }
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  static async createRefund(req, res, next) {
    try {
      const { paymentId } = req.params;
      const { amount, reason } = req.body;
      const customerId = req.user.id;
      const payment = await Payment.findOne({ _id: paymentId, customerId });
      if (!payment) return next(new AppError('Payment not found', 404));
      if (!payment.canBeRefunded()) return next(new AppError('Payment cannot be refunded', 400));

      const refundResult = await razorpayService.createRefund(payment.razorpayPaymentId, {
        amount,
        notes: {
          reason,
          requestedBy: customerId.toString(),
          paymentId: paymentId.toString()
        }
      });

      if (!refundResult.success) return next(new AppError('Failed to create refund', 500));

      await Payment.findByIdAndUpdate(paymentId, {
        refundId: refundResult.refund.id,
        refundAmount: refundResult.refund.amount / 100,
        refundStatus: 'pending',
        metadata: {
          ...payment.metadata,
          refundCreatedAt: new Date(),
          refundReason: reason
        }
      });

      res.json({
        success: true,
        data: {
          refund: refundResult.refund,
          message: 'Refund initiated successfully'
        }
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  static async getPaymentStats(req, res, next) {
    try {
      const customerId = req.user.id;
      const { startDate, endDate } = req.query;
      const stats = await Payment.getPaymentStats(customerId, startDate, endDate);
      res.json({ success: true, data: { stats } });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  static async getRazorpayConfig(req, res, next) {
    try {
      const config = razorpayService.getConfig();
      res.json({ success: true, data: { config } });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }

  static async healthCheck(req, res, next) {
    try {
      const razorpayHealth = await razorpayService.healthCheck();
      res.json({
        success: true,
        data: {
          service: 'payment',
          status: razorpayHealth.status,
          razorpay: razorpayHealth,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      next(new AppError(error.message, 500));
    }
  }
}

export default PaymentController;
