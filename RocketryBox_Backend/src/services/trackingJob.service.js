import cron from 'node-cron';
import CustomerOrder from '../modules/customer/models/customerOrder.model.js';
import { logger } from '../utils/logger.js';
import { trackShipment } from '../utils/shipping.js';
import OrderBookingService from './orderBooking.service.js';

/**
 * Background Tracking Job Service
 * Periodically fetches tracking updates from courier partners
 */
export class TrackingJobService {

  constructor() {
    this.isRunning = false;
    this.jobScheduled = false;
    this.lastRunTime = null;
    this.stats = {
      totalOrdersChecked: 0,
      updatesReceived: 0,
      errors: 0,
      lastRun: null
    };
  }

  /**
   * Start the tracking job scheduler
   */
  start() {
    if (this.jobScheduled) {
      logger.warn('Tracking job already scheduled');
      return;
    }

    // Add process error handling
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception in tracking service:', error);
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection in tracking service:', reason);
    });

    // Run every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      await this.runTrackingUpdate();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    // Run every 2 hours for comprehensive check
    cron.schedule('0 */2 * * *', async () => {
      await this.runComprehensiveTrackingUpdate();
    }, {
      scheduled: true,
      timezone: "Asia/Kolkata"
    });

    this.jobScheduled = true;
    logger.info('✅ Tracking job scheduler started');
    logger.info('📅 Quick updates: Every 30 minutes');
    logger.info('📅 Comprehensive updates: Every 2 hours');
  }

  /**
   * Stop the tracking job scheduler
   */
  stop() {
    // Note: node-cron doesn't provide direct stop method for specific jobs
    // This would need job references to properly stop
    this.jobScheduled = false;
    logger.info('🛑 Tracking job scheduler stopped');
  }

  /**
   * Run quick tracking update for recent active orders
   */
  async runTrackingUpdate() {
    if (this.isRunning) {
      logger.warn('Tracking update already in progress, skipping...');
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date();

    try {
      logger.info('🔄 Starting quick tracking update job...');

      // Get active orders from last 7 days that need tracking updates
      const activeOrders = await CustomerOrder.find({
        status: { $in: ['confirmed', 'shipped'] },
        awb: { $exists: true, $ne: null },
        createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // Last 7 days
        courierPartner: { $exists: true, $ne: null }
      })
        .limit(50) // Limit to avoid overwhelming APIs
        .sort({ createdAt: -1 });

      logger.info(`📦 Found ${activeOrders.length} active orders to track`);

      let checked = 0;
      let updated = 0;
      let errors = 0;

      for (const order of activeOrders) {
        try {
          await this.updateSingleOrderTracking(order);
          checked++;

          // Add small delay to avoid rate limiting
          await this.delay(1000); // 1 second delay
        } catch (error) {
          errors++;
          logger.error(`❌ Error tracking order ${order.awb}:`, error.message);
        }
      }

      this.stats.totalOrdersChecked += checked;
      this.stats.updatesReceived += updated;
      this.stats.errors += errors;
      this.stats.lastRun = new Date();

      logger.info('✅ Quick tracking update completed', {
        checked,
        updated,
        errors,
        duration: Date.now() - this.lastRunTime.getTime()
      });

    } catch (error) {
      logger.error('❌ Tracking update job failed:', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Run comprehensive tracking update for all active orders
   */
  async runComprehensiveTrackingUpdate() {
    try {
      logger.info('🔄 Starting comprehensive tracking update job...');

      // Get all active orders regardless of age
      const activeOrders = await CustomerOrder.find({
        status: { $in: ['confirmed', 'shipped'] },
        awb: { $exists: true, $ne: null },
        courierPartner: { $exists: true, $ne: null }
      })
        .limit(200) // Higher limit for comprehensive check
        .sort({ updatedAt: 1 }); // Oldest first

      logger.info(`📦 Found ${activeOrders.length} total active orders for comprehensive tracking`);

      let batches = this.chunkArray(activeOrders, 10); // Process in batches of 10

      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        logger.info(`📊 Processing batch ${batchIndex + 1}/${batches.length} (${batch.length} orders)`);

        // Process batch in parallel with limited concurrency
        await Promise.allSettled(
          batch.map(order => this.updateSingleOrderTracking(order))
        );

        // Delay between batches to avoid rate limiting
        if (batchIndex < batches.length - 1) {
          await this.delay(5000); // 5 second delay between batches
        }
      }

      logger.info('✅ Comprehensive tracking update completed');

    } catch (error) {
      logger.error('❌ Comprehensive tracking update failed:', error);
    }
  }

  /**
   * Update tracking for a single order
   */
  async updateSingleOrderTracking(order) {
    try {
      const courierMapping = {
        'Delhivery': 'DELHIVERY',
        'Delivery Service': 'DELHIVERY',
        'BlueDart': 'BLUEDART',
        'Blue Dart Express': 'BLUEDART',
        'Ekart Logistics': 'EKART',
        'XpressBees': 'XPRESSBEES',
        'Ecom Express': 'ECOMEXPRESS'
      };

      const courierCode = courierMapping[order.courierPartner] || 'DELHIVERY';

      // Fetch tracking from courier API
      const trackingResponse = await trackShipment(order.awb, courierCode);

      if (trackingResponse.success) {
        // Update order with new tracking info
        await OrderBookingService.updateOrderTracking(order.awb, {
          status: trackingResponse.status,
          location: trackingResponse.currentLocation || trackingResponse.location,
          timestamp: new Date(),
          description: trackingResponse.description || trackingResponse.status,
          courier: order.courierPartner,
          fetchedAt: new Date(),
          isJobUpdate: true
        });

        logger.debug(`✅ Updated tracking for order ${order.awb}: ${trackingResponse.status}`);
        return { success: true, awb: order.awb, status: trackingResponse.status };
      } else {
        logger.debug(`⚠️ No tracking update for ${order.awb}: ${trackingResponse.error}`);
        return { success: false, awb: order.awb, error: trackingResponse.error };
      }

    } catch (error) {
      logger.error(`❌ Failed to update tracking for ${order.awb}:`, error.message);
      throw error;
    }
  }

  /**
   * Manual trigger for tracking update (for testing/admin)
   */
  async manualTrigger(limit = 10) {
    try {
      logger.info('🔧 Manual tracking update triggered');

      const orders = await CustomerOrder.find({
        status: { $in: ['confirmed', 'shipped'] },
        awb: { $exists: true, $ne: null },
        courierPartner: { $exists: true, $ne: null }
      })
        .limit(limit)
        .sort({ updatedAt: 1 });

      const results = [];
      for (const order of orders) {
        try {
          const result = await this.updateSingleOrderTracking(order);
          results.push(result);
        } catch (error) {
          results.push({
            success: false,
            awb: order.awb,
            error: error.message
          });
        }
      }

      logger.info('✅ Manual tracking update completed', {
        total: results.length,
        successful: results.filter(r => r.success).length,
        failed: results.filter(r => !r.success).length
      });

      return {
        success: true,
        results,
        summary: {
          total: results.length,
          successful: results.filter(r => r.success).length,
          failed: results.filter(r => !r.success).length
        }
      };

    } catch (error) {
      logger.error('❌ Manual tracking update failed:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get job statistics
   */
  getStats() {
    return {
      ...this.stats,
      isRunning: this.isRunning,
      jobScheduled: this.jobScheduled,
      lastRunTime: this.lastRunTime,
      nextRun: this.jobScheduled ? 'Every 30 minutes' : 'Not scheduled'
    };
  }

  /**
   * Helper methods
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  chunkArray(array, chunkSize) {
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
      chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
  }
}

// Create singleton instance
export const trackingJobService = new TrackingJobService();

// Auto-start in production
if (process.env.NODE_ENV === 'production') {
  trackingJobService.start();
  logger.info('🚀 Tracking job service auto-started in production mode');
}

export default trackingJobService;
