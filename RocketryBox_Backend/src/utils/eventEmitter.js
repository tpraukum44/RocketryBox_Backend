import EventEmitter from 'events';
import { 
  broadcastDashboardUpdates, 
  broadcastDashboardSectionUpdate
} from '../modules/admin/services/realtime.service.js';
import { logger } from './logger.js';

// Create event emitter
const eventEmitter = new EventEmitter();

// Event types
export const EVENT_TYPES = {
  // Customer events
  CUSTOMER_REGISTERED: 'customer:registered',
  CUSTOMER_UPDATED: 'customer:updated',
  CUSTOMER_LOGIN: 'customer:login',
  CUSTOMER_ACTIVITY: 'customer:activity',
  
  // Seller events
  SELLER_REGISTERED: 'seller:registered',
  SELLER_UPDATED: 'seller:updated',
  SELLER_LOGIN: 'seller:login',
  SELLER_ACTIVITY: 'seller:activity',
  
  // Order events
  ORDER_CREATED: 'order:created',
  ORDER_UPDATED: 'order:updated',
  ORDER_STATUS_CHANGED: 'order:status_changed',
  
  // Payment events
  PAYMENT_COMPLETED: 'payment:completed',
  PAYMENT_FAILED: 'payment:failed',
  
  // Product events
  PRODUCT_CREATED: 'product:created',
  PRODUCT_UPDATED: 'product:updated',
  PRODUCT_VIEWED: 'product:viewed',
  
  // Shipment events
  SHIPMENT_CREATED: 'shipment:created',
  SHIPMENT_UPDATED: 'shipment:updated',
  SHIPMENT_STATUS_CHANGED: 'shipment:status_changed'
};

// Map event types to dashboard sections for selective updates
export const EVENT_TO_SECTION_MAP = {
  // User-related events update the users section
  [EVENT_TYPES.CUSTOMER_REGISTERED]: 'users',
  [EVENT_TYPES.CUSTOMER_LOGIN]: 'users',
  [EVENT_TYPES.SELLER_REGISTERED]: 'users',
  [EVENT_TYPES.SELLER_LOGIN]: 'users',
  [EVENT_TYPES.CUSTOMER_ACTIVITY]: 'activities',
  
  // Order-related events update orders and revenue sections
  [EVENT_TYPES.ORDER_CREATED]: ['orders', 'revenue'],
  [EVENT_TYPES.ORDER_UPDATED]: ['orders', 'revenue'],
  [EVENT_TYPES.ORDER_STATUS_CHANGED]: ['orders', 'revenue'],
  
  // Payment events update the revenue section
  [EVENT_TYPES.PAYMENT_COMPLETED]: 'revenue',
  
  // Product events update the products section
  [EVENT_TYPES.PRODUCT_VIEWED]: 'products',
  
  // Shipment events update the orders section
  [EVENT_TYPES.SHIPMENT_STATUS_CHANGED]: 'orders'
};

// Rate limiting for events (maximum events per time period)
const EVENT_RATE_LIMITS = new Map();
const RATE_LIMIT_WINDOW = 5000; // 5 seconds
const RATE_LIMIT_MAX = 10; // Max 10 events per 5 seconds for each type

/**
 * Check if an event is rate limited
 * @param {string} eventType - Event type
 * @returns {boolean} True if rate limited, false otherwise
 */
const isRateLimited = (eventType) => {
  const now = Date.now();
  
  if (!EVENT_RATE_LIMITS.has(eventType)) {
    EVENT_RATE_LIMITS.set(eventType, {
      count: 1,
      timestamp: now
    });
    return false;
  }
  
  const limit = EVENT_RATE_LIMITS.get(eventType);
  
  // Reset counter if window has passed
  if (now - limit.timestamp > RATE_LIMIT_WINDOW) {
    limit.count = 1;
    limit.timestamp = now;
    return false;
  }
  
  // Increment counter and check limit
  limit.count++;
  if (limit.count > RATE_LIMIT_MAX) {
    return true;
  }
  
  return false;
};

// Set up event listeners
export const setupEventListeners = () => {
  // Set up section-specific event listeners
  Object.keys(EVENT_TO_SECTION_MAP).forEach(eventType => {
    eventEmitter.on(eventType, async (data) => {
      // Skip if rate limited
      if (isRateLimited(eventType)) {
        logger.debug(`Event ${eventType} rate limited`);
        return;
      }
      
      logger.debug(`Event triggered: ${eventType}`, { data });
      
      const sections = EVENT_TO_SECTION_MAP[eventType];
      
      if (Array.isArray(sections)) {
        // Update multiple sections if array
        for (const section of sections) {
          await broadcastDashboardSectionUpdate(section);
        }
      } else if (sections) {
        // Update single section
        await broadcastDashboardSectionUpdate(sections);
      } else {
        // Fallback to full update if no section mapping found
        await broadcastDashboardUpdates();
      }
    });
  });
  
  // Set up debounced full dashboard update for multiple events in short period
  let dashboardUpdateTimeout = null;
  
  eventEmitter.on('multiple-updates', async () => {
    if (dashboardUpdateTimeout) {
      clearTimeout(dashboardUpdateTimeout);
    }
    
    dashboardUpdateTimeout = setTimeout(async () => {
      await broadcastDashboardUpdates();
      dashboardUpdateTimeout = null;
    }, 1000); // 1 second debounce
  });
  
  logger.info('Event listeners setup complete');
};

// Emit an event
export const emitEvent = (eventType, data = {}) => {
  logger.debug(`Emitting event: ${eventType}`, { data });
  eventEmitter.emit(eventType, data);
  
  // If we've had a high volume of events, emit a single dashboard update 
  // instead of multiple section updates
  if (Object.values(EVENT_RATE_LIMITS).some(limit => limit.count > 5)) {
    eventEmitter.emit('multiple-updates');
  }
};

export default eventEmitter; 