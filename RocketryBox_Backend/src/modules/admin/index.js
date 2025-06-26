import express from 'express';
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import teamRoutes from './routes/team.routes.js';
import configRoutes from './routes/config.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';
import shippingPartnerRoutes from './routes/shippingPartner.routes.js';
import shippingRoutes from './routes/shipping.routes.js';
import orderRoutes from './routes/order.routes.js';
import shipmentRoutes from './routes/shipment.routes.js';
import ticketRoutes from './routes/ticket.routes.js';
import ndrRoutes from './routes/ndr.routes.js';
import reportRoutes from './routes/report.routes.js';
import escalationRoutes from './routes/escalation.routes.js';
import settingsRoutes from './routes/settings.routes.js';
import policyRoutes from './routes/policy.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import maintenanceRoutes from './routes/maintenance.routes.js';
import billingRoutes from './routes/billing.routes.js';
import rateCardRoutes from './routes/ratecard.routes.js';

const router = express.Router();

// Authentication routes
router.use('/auth', authRoutes);

// User (Seller/Customer) management routes
router.use('/users', userRoutes);

// Team management routes
router.use('/team', teamRoutes);

// Config/settings routes
router.use('/config', configRoutes);

// Dashboard analytics routes
router.use('/dashboard', dashboardRoutes);

// Shipping partner management routes
router.use('/partners', shippingPartnerRoutes);

// Shipping integration management routes
router.use('/shipping', shippingRoutes);

// Order management routes
router.use('/orders', orderRoutes);

// Shipment management routes
router.use('/shipments', shipmentRoutes);

// Support ticket management routes 
router.use('/tickets', ticketRoutes);

// NDR management routes
router.use('/ndr', ndrRoutes);

// Reports and analytics routes
router.use('/reports', reportRoutes);

// Escalation management routes
router.use('/escalations', escalationRoutes);

// Settings routes
router.use('/settings', settingsRoutes);

// Policy management routes
router.use('/settings/policy', policyRoutes);

// Notification settings routes
router.use('/settings/notification', notificationRoutes);

// Maintenance mode routes
router.use('/settings/maintenance', maintenanceRoutes);

// Billing management routes
router.use('/billing', billingRoutes);

// Rate card management routes
router.use('/ratecards', rateCardRoutes);

export default router; 