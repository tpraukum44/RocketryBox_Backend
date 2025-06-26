import { EventEmitter } from 'events';
import { logger } from './logger.js';

/**
 * Real-time Events System for RocketryBox
 * Handles order status updates, tracking changes, and real-time notifications
 */

// Create global event emitter
const eventEmitter = new EventEmitter();

// Increase max listeners to handle multiple order updates
eventEmitter.setMaxListeners(100);

// Event type constants
export const EVENT_TYPES = {
  // Order Events
  ORDER_CREATED: 'order:created',
  ORDER_STATUS_UPDATED: 'order:status_updated',
  ORDER_CANCELLED: 'order:cancelled',
  ORDER_DELIVERED: 'order:delivered',

  // Payment Events
  PAYMENT_RECEIVED: 'payment:received',
  PAYMENT_FAILED: 'payment:failed',
  PAYMENT_REFUNDED: 'payment:refunded',

  // Tracking Events
  TRACKING_UPDATED: 'tracking:updated',
  SHIPMENT_PICKED_UP: 'shipment:picked_up',
  SHIPMENT_IN_TRANSIT: 'shipment:in_transit',
  SHIPMENT_OUT_FOR_DELIVERY: 'shipment:out_for_delivery',
  SHIPMENT_DELIVERED: 'shipment:delivered',
  SHIPMENT_FAILED: 'shipment:failed',

  // Courier Events
  AWB_GENERATED: 'courier:awb_generated',
  COURIER_BOOKING_FAILED: 'courier:booking_failed',
  COURIER_API_ERROR: 'courier:api_error',

  // System Events
  WEBHOOK_RECEIVED: 'system:webhook_received',
  BULK_UPDATE_COMPLETED: 'system:bulk_update_completed',
  JOB_COMPLETED: 'system:job_completed'
};

/**
 * Emit an event with logging
 * @param {string} eventType - Event type from EVENT_TYPES
 * @param {Object} data - Event data
 */
export const emitEvent = (eventType, data) => {
  try {
    logger.debug(`📡 Emitting event: ${eventType}`, {
      eventType,
      dataKeys: Object.keys(data || {}),
      timestamp: new Date().toISOString()
    });

    eventEmitter.emit(eventType, {
      ...data,
      timestamp: new Date(),
      eventType
    });
  } catch (error) {
    logger.error(`❌ Error emitting event ${eventType}:`, error);
  }
};

/**
 * Subscribe to an event
 * @param {string} eventType - Event type to listen for
 * @param {Function} handler - Event handler function
 */
export const onEvent = (eventType, handler) => {
  try {
    eventEmitter.on(eventType, handler);
    logger.debug(`👂 Event listener registered for: ${eventType}`);
  } catch (error) {
    logger.error(`❌ Error registering event listener for ${eventType}:`, error);
  }
};

/**
 * Subscribe to an event once
 * @param {string} eventType - Event type to listen for
 * @param {Function} handler - Event handler function
 */
export const onceEvent = (eventType, handler) => {
  try {
    eventEmitter.once(eventType, handler);
    logger.debug(`👂 One-time event listener registered for: ${eventType}`);
  } catch (error) {
    logger.error(`❌ Error registering one-time event listener for ${eventType}:`, error);
  }
};

/**
 * Remove event listener
 * @param {string} eventType - Event type
 * @param {Function} handler - Handler to remove
 */
export const offEvent = (eventType, handler) => {
  try {
    eventEmitter.off(eventType, handler);
    logger.debug(`🔇 Event listener removed for: ${eventType}`);
  } catch (error) {
    logger.error(`❌ Error removing event listener for ${eventType}:`, error);
  }
};

/**
 * Get event statistics
 */
export const getEventStats = () => {
  const listeners = {};
  for (const eventType of Object.values(EVENT_TYPES)) {
    listeners[eventType] = eventEmitter.listenerCount(eventType);
  }

  return {
    totalListeners: eventEmitter.listenerCount(),
    maxListeners: eventEmitter.getMaxListeners(),
    eventTypes: Object.keys(EVENT_TYPES).length,
    listeners
  };
};

/**
 * Initialize default event handlers
 */
export const initializeEventHandlers = () => {

  // Order Status Update Handler
  onEvent(EVENT_TYPES.ORDER_STATUS_UPDATED, async (data) => {
    logger.info('📦 Order status updated', {
      orderId: data.orderId,
      awb: data.awb,
      status: data.status,
      location: data.location
    });

    // TODO: Send real-time notification to frontend via WebSocket
    // TODO: Send SMS/Email notifications based on user preferences
    // TODO: Update analytics/dashboard metrics
  });

  // Order Created Handler
  onEvent(EVENT_TYPES.ORDER_CREATED, async (data) => {
    logger.info('🎉 New order created', {
      orderId: data.orderId,
      orderNumber: data.orderNumber,
      awb: data.awb,
      courierPartner: data.courierPartner,
      totalAmount: data.totalAmount
    });

    // TODO: Send order confirmation SMS/Email
    // TODO: Notify seller if applicable
    // TODO: Update dashboard metrics
  });

  // AWB Generated Handler
  onEvent(EVENT_TYPES.AWB_GENERATED, async (data) => {
    logger.info('🏷️ AWB generated', {
      orderId: data.orderId,
      awb: data.awb,
      courierPartner: data.courierPartner,
      bookingType: data.bookingType
    });

    // TODO: Send AWB notification to customer
    // TODO: Update order tracking page
  });

  // Tracking Updated Handler
  onEvent(EVENT_TYPES.TRACKING_UPDATED, async (data) => {
    logger.info('📍 Tracking updated', {
      awb: data.awb,
      status: data.status,
      location: data.location,
      courier: data.courier
    });

    // TODO: Push real-time update to frontend
    // TODO: Send tracking notification if significant status change
  });

  // Shipment Delivered Handler
  onEvent(EVENT_TYPES.SHIPMENT_DELIVERED, async (data) => {
    logger.info('✅ Shipment delivered', {
      orderId: data.orderId,
      awb: data.awb,
      deliveredAt: data.timestamp
    });

    // TODO: Send delivery confirmation
    // TODO: Request feedback/rating
    // TODO: Update delivery metrics
  });

  // Courier Booking Failed Handler
  onEvent(EVENT_TYPES.COURIER_BOOKING_FAILED, async (data) => {
    logger.warn('⚠️ Courier booking failed', {
      orderId: data.orderId,
      courierPartner: data.courierPartner,
      error: data.error
    });

    // TODO: Notify operations team
    // TODO: Try alternate courier
    // TODO: Update order status to require manual booking
  });

  // Webhook Received Handler
  onEvent(EVENT_TYPES.WEBHOOK_RECEIVED, async (data) => {
    logger.debug('📨 Webhook received', {
      source: data.source,
      awb: data.awb,
      status: data.status
    });
  });

  logger.info('✅ Event handlers initialized');
};

/**
 * Cleanup event listeners
 */
export const cleanup = () => {
  eventEmitter.removeAllListeners();
  logger.info('🧹 Event listeners cleaned up');
};

// Initialize handlers when module is imported
initializeEventHandlers();

// Export the raw event emitter for advanced usage
export { eventEmitter };

export default {
  emitEvent,
  onEvent,
  onceEvent,
  offEvent,
  getEventStats,
  initializeEventHandlers,
  cleanup,
  EVENT_TYPES,
  eventEmitter
};
