import express from 'express';
import { authenticateSeller } from '../../../middleware/auth.js';
import { validationHandler } from '../../../middleware/validator.js';
import { createTicketSchema, addTicketResponseSchema } from '../validators/support.validator.js';
import { listTickets, createTicket, getTicketDetails, addTicketResponse } from '../controllers/support.controller.js';

const router = express.Router();

router.use(authenticateSeller);

// List tickets
router.get('/support-tickets', listTickets);
// Create ticket
router.post('/support-tickets', validationHandler(createTicketSchema), createTicket);
// Get ticket details
router.get('/support-tickets/:id', getTicketDetails);
// Add ticket response
router.post('/support-tickets/:id/responses', validationHandler(addTicketResponseSchema), addTicketResponse);

export default router; 
