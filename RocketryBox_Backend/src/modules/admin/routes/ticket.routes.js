import express from 'express';
import {
  getTickets,
  getTicketById,
  createTicket,
  updateTicketStatus,
  assignTicket,
  addResponse,
  getTicketStats,
  exportTickets
} from '../controllers/ticket.controller.js';
import {
  validateCreateTicket,
  validateUpdateStatus,
  validateAssignTicket,
  validateAddResponse,
  validateListTickets,
  validateExportTickets
} from '../validators/ticket.validator.js';
import { protect } from '../../../middleware/auth.js';
import { checkPermission } from '../../../middleware/permission.js';
import { upload } from '../../../middleware/fileUpload.js';

const router = express.Router();

// Ticket listing and stats
router.get(
  '/',
  protect,
  checkPermission('supportTickets'),
  validateListTickets,
  getTickets
);

// Ticket statistics for dashboard
router.get(
  '/stats',
  protect,
  checkPermission('supportTickets', 'reportsAnalytics'),
  getTicketStats
);

// Export tickets
router.get(
  '/export',
  protect,
  checkPermission('supportTickets', 'reportsAnalytics'),
  validateExportTickets,
  exportTickets
);

// Get single ticket
router.get(
  '/:id',
  protect,
  checkPermission('supportTickets'),
  getTicketById
);

// Create new ticket
router.post(
  '/',
  protect,
  checkPermission('supportTickets'),
  upload.array('attachments', 5), // Allow up to 5 file attachments
  validateCreateTicket,
  createTicket
);

// Update ticket status
router.patch(
  '/:id/status',
  protect,
  checkPermission('supportTickets'),
  validateUpdateStatus,
  updateTicketStatus
);

// Assign ticket to admin
router.patch(
  '/:id/assign',
  protect,
  checkPermission('supportTickets', 'teamManagement'),
  validateAssignTicket,
  assignTicket
);

// Add response to ticket
router.post(
  '/:id/responses',
  protect,
  checkPermission('supportTickets'),
  upload.array('attachments', 5), // Allow up to 5 file attachments
  validateAddResponse,
  addResponse
);

export default router; 