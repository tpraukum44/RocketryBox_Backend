import { AppError } from '../../../middleware/errorHandler.js';
import SupportTicket from '../models/supportTicket.model.js';
import TicketResponse from '../models/ticketResponse.model.js';

// List support tickets
export const listTickets = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, category } = req.query;
    const query = { seller: req.user.id };
    if (status) query.status = status;
    if (category) query.category = category;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      SupportTicket.countDocuments(query)
    ]);
    res.status(200).json({
      success: true,
      data: {
        tickets,
        pagination: {
          total,
          page: parseInt(page),
          limit: parseInt(limit),
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create support ticket
export const createTicket = async (req, res, next) => {
  try {
    const { subject, category, priority, message, attachments } = req.body;
    const ticket = await SupportTicket.create({
      seller: req.user.id,
      subject,
      category,
      priority,
      message,
      attachments
    });
    res.status(201).json({ success: true, data: ticket });
  } catch (error) {
    next(error);
  }
};

// Get ticket details
export const getTicketDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const ticket = await SupportTicket.findOne({ _id: id, seller: req.user.id });
    if (!ticket) throw new AppError('Ticket not found', 404);
    const responses = await TicketResponse.find({ ticket: id }).sort({ createdAt: 1 });
    res.status(200).json({ success: true, data: { ticket, responses } });
  } catch (error) {
    next(error);
  }
};

// Add ticket response
export const addTicketResponse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message, attachments } = req.body;
    const ticket = await SupportTicket.findOne({ _id: id, seller: req.user.id });
    if (!ticket) throw new AppError('Ticket not found', 404);
    const response = await TicketResponse.create({
      ticket: id,
      sender: 'seller',
      message,
      attachments
    });
    // Optionally update ticket status
    if (ticket.status === 'Resolved' || ticket.status === 'Closed') {
      ticket.status = 'Open';
      await ticket.save();
    }
    res.status(201).json({ success: true, data: response });
  } catch (error) {
    next(error);
  }
};
