import AdminSupportTicket from '../models/ticket.model.js';
import Admin from '../models/admin.model.js';
import Seller from '../../seller/models/seller.model.js';
import Customer from '../../customer/models/customer.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../../../utils/logger.js';
import { sendEmail } from '../../../utils/email.js';
import { sendSMS } from '../../../utils/sms.js';
import { uploadFile } from '../../../utils/fileUpload.js';
import { io } from '../../../server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Get all tickets with filtering, sorting, and pagination
 * @route GET /api/v2/admin/support/tickets
 * @access Private (Admin, Support role)
 */
export const getTickets = async (req, res, next) => {
  try {
    const {
      search,
      status,
      category,
      priority,
      assignedTo,
      from,
      to,
      customerType,
      customerId,
      sortField = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 20
    } = req.query;

    // Build filter object
    const filter = {};
    
    // Search across multiple fields
    if (search) {
      filter.$or = [
        { ticketId: new RegExp(search, 'i') },
        { subject: new RegExp(search, 'i') },
        { 'customer.name': new RegExp(search, 'i') },
        { 'customer.email': new RegExp(search, 'i') },
        { 'customer.phone': new RegExp(search, 'i') }
      ];
    }
    
    // Standard filters
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;
    if (assignedTo) filter['assignedTo.id'] = assignedTo;
    if (customerType) filter['customer.type'] = customerType;
    if (customerId) filter['customer.id'] = customerId;
    
    // Date range filters
    if (from || to) {
      filter.createdAt = {};
      if (from) filter.createdAt.$gte = new Date(from);
      if (to) {
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }

    // Role-based filters (non-super admins can only see tickets assigned to them or unassigned)
    if (!req.user.isSuperAdmin && req.user.role !== 'Manager') {
      filter.$or = filter.$or || [];
      filter.$or.push(
        { 'assignedTo.id': req.user.id },
        { 'assignedTo.id': { $exists: false } }
      );
    }

    // Calculate pagination
    const pageNum = parseInt(page);
    const limitNum = parseInt(limit);
    const skip = (pageNum - 1) * limitNum;

    // Sort configuration
    const sort = {};
    sort[sortField || 'createdAt'] = sortOrder === 'asc' ? 1 : -1;

    // Execute query with pagination
    const [tickets, total] = await Promise.all([
      AdminSupportTicket.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .lean(),
      AdminSupportTicket.countDocuments(filter)
    ]);

    // Calculate SLA violation status for each ticket
    const ticketsWithSlaStatus = tickets.map(ticket => {
      const now = new Date();
      let slaStatus = 'on-track';
      
      if (ticket.sla && ticket.sla.dueDate) {
        const dueDate = new Date(ticket.sla.dueDate);
        if (ticket.status !== 'Resolved' && ticket.status !== 'Closed') {
          if (now > dueDate) {
            slaStatus = 'breached';
          } else {
            // Calculate warning threshold (80% of time elapsed)
            const createdAt = new Date(ticket.createdAt);
            const totalTime = dueDate - createdAt;
            const elapsedTime = now - createdAt;
            if (elapsedTime / totalTime > 0.8) {
              slaStatus = 'at-risk';
            }
          }
        }
      }
      
      return {
        ...ticket,
        slaStatus
      };
    });

    res.status(200).json({
      success: true,
      count: tickets.length,
      total,
      totalPages: Math.ceil(total / limitNum),
      currentPage: pageNum,
      data: ticketsWithSlaStatus
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get ticket by ID
 * @route GET /api/v2/admin/support/tickets/:id
 * @access Private (Admin, Support role)
 */
export const getTicketById = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid ticket ID format', 400));
    }

    // Find the ticket
    const ticket = await AdminSupportTicket.findById(id);

    if (!ticket) {
      return next(new AppError('Ticket not found', 404));
    }

    // Check access rights (super admins can access all tickets)
    if (!req.user.isSuperAdmin && req.user.role !== 'Manager') {
      // Support staff can only access tickets assigned to them or unassigned
      const isAssigned = ticket.assignedTo && ticket.assignedTo.id && 
                         ticket.assignedTo.id.toString() === req.user.id.toString();
      
      if (!isAssigned && ticket.assignedTo && ticket.assignedTo.id) {
        return next(new AppError('You do not have permission to access this ticket', 403));
      }
    }

    res.status(200).json({
      success: true,
      data: ticket
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Create a new ticket
 * @route POST /api/v2/admin/support/tickets
 * @access Private (Admin, Support role)
 */
export const createTicket = async (req, res, next) => {
  try {
    const {
      subject,
      category,
      priority,
      customerType,
      customerId,
      details,
      relatedEntities
    } = req.body;

    // Verify customer exists
    let customerModel, customerDoc;
    if (customerType === 'seller') {
      customerModel = 'Seller';
      customerDoc = await Seller.findById(customerId);
    } else if (customerType === 'customer') {
      customerModel = 'Customer';
      customerDoc = await Customer.findById(customerId);
    }

    if (!customerDoc) {
      return next(new AppError(`${customerType} not found with ID ${customerId}`, 404));
    }

    // Process file uploads if any
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadedFile = await uploadFile(file);
          attachments.push({
            name: file.originalname,
            url: uploadedFile.url,
            type: file.mimetype,
            size: file.size
          });
        } catch (error) {
          logger.error(`File upload error: ${error.message}`);
          // Continue with other files even if one fails
        }
      }
    }

    // Create ticket with SLA calculation
    const ticket = new AdminSupportTicket({
      subject,
      category,
      priority: priority || 'Medium',
      customer: {
        id: customerId,
        name: customerDoc.name || customerDoc.fullName || '',
        email: customerDoc.email || '',
        phone: customerDoc.phone || customerDoc.contactNumber || '',
        type: customerType
      },
      customerModel: customerModel,
      details,
      attachments,
      relatedEntities,
      // Calculate SLA due date
      sla: calculateSLA(category, priority || 'Medium')
    });

    await ticket.save();

    // Notify customer about ticket creation
    try {
      const customerEmail = customerDoc.email;
      if (customerEmail) {
        await sendEmail({
          to: customerEmail,
          subject: `Ticket Created - ${ticket.ticketId}`,
          template: 'ticket-created',
          data: {
            name: customerDoc.name || customerDoc.fullName || 'Valued Customer',
            ticketId: ticket.ticketId,
            subject: ticket.subject,
            details: ticket.details,
            category: ticket.category,
            priority: ticket.priority
          }
        });
      }
    } catch (emailError) {
      logger.error(`Error sending ticket creation email: ${emailError.message}`);
      // Continue even if email fails
    }

    // Notify admins via Socket.IO
    io.to('admin-support').emit('new-ticket', {
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      priority: ticket.priority,
      category: ticket.category,
      customer: {
        name: ticket.customer.name,
        type: ticket.customer.type
      },
      createdAt: ticket.createdAt
    });

    res.status(201).json({
      success: true,
      data: ticket,
      message: 'Support ticket created successfully'
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Update ticket status
 * @route PATCH /api/v2/admin/support/tickets/:id/status
 * @access Private (Admin, Support role)
 */
export const updateTicketStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, reason } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid ticket ID format', 400));
    }

    // Find the ticket
    const ticket = await AdminSupportTicket.findById(id);

    if (!ticket) {
      return next(new AppError('Ticket not found', 404));
    }

    // Check access rights
    if (!req.user.isSuperAdmin && req.user.role !== 'Manager') {
      const isAssigned = ticket.assignedTo && ticket.assignedTo.id && 
                         ticket.assignedTo.id.toString() === req.user.id.toString();
      
      if (!isAssigned) {
        return next(new AppError('You do not have permission to update this ticket', 403));
      }
    }

    // Update status and add response with the reason
    const previousStatus = ticket.status;
    ticket.status = status;
    
    // Calculate resolution time if resolving
    if ((status === 'Resolved' || status === 'Closed') && 
        (previousStatus !== 'Resolved' && previousStatus !== 'Closed')) {
      const createdAt = new Date(ticket.createdAt);
      const now = new Date();
      const diffInMilliseconds = now - createdAt;
      ticket.resolutionTime = Math.floor(diffInMilliseconds / (1000 * 60)); // Minutes
    }

    // Add response if reason provided
    if (reason) {
      ticket.responses.push({
        message: `Status changed from ${previousStatus} to ${status}: ${reason}`,
        sender: 'admin',
        createdAt: new Date()
      });
    }

    // Update the ticket
    await ticket.save();

    // Notify customer about status change
    try {
      const customerEmail = ticket.customer.email;
      if (customerEmail) {
        await sendEmail({
          to: customerEmail,
          subject: `Ticket Status Updated - ${ticket.ticketId}`,
          template: 'ticket-status-update',
          data: {
            name: ticket.customer.name || 'Valued Customer',
            ticketId: ticket.ticketId,
            subject: ticket.subject,
            previousStatus,
            newStatus: status,
            reason: reason || 'No reason provided'
          }
        });
      }
    } catch (emailError) {
      logger.error(`Error sending ticket status update email: ${emailError.message}`);
      // Continue even if email fails
    }

    // Notify via Socket.IO
    io.to('admin-support').emit('ticket-updated', {
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      previousStatus,
      status: ticket.status,
      updatedBy: req.user.name
    });

    res.status(200).json({
      success: true,
      data: {
        id: ticket._id,
        status: ticket.status,
        message: `Ticket status updated to ${status} successfully`
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Assign ticket to an admin user
 * @route PATCH /api/v2/admin/support/tickets/:id/assign
 * @access Private (Admin, Manager role)
 */
export const assignTicket = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assignedTo } = req.body;

    // Validate IDs
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid ticket ID format', 400));
    }

    if (!mongoose.Types.ObjectId.isValid(assignedTo)) {
      return next(new AppError('Invalid admin ID format', 400));
    }

    // Find the ticket
    const ticket = await AdminSupportTicket.findById(id);

    if (!ticket) {
      return next(new AppError('Ticket not found', 404));
    }

    // Find the admin user
    const admin = await Admin.findById(assignedTo);

    if (!admin) {
      return next(new AppError('Admin user not found', 404));
    }

    // Verify admin has support role
    if (!admin.permissions.supportTickets) {
      return next(new AppError('Selected admin does not have support ticket permissions', 400));
    }

    // Check if this is the first assignment (for first response time calculation)
    const isFirstAssignment = !ticket.assignedTo || !ticket.assignedTo.id;
    
    // Update ticket assignment
    ticket.assignedTo = {
      id: admin._id,
      name: admin.name,
      role: admin.role
    };

    // Calculate first response time if first assignment and add a response entry
    if (isFirstAssignment) {
      const createdAt = new Date(ticket.createdAt);
      const now = new Date();
      const diffInMilliseconds = now - createdAt;
      ticket.firstResponseTime = Math.floor(diffInMilliseconds / (1000 * 60)); // Minutes

      ticket.responses.push({
        message: `Ticket assigned to ${admin.name}`,
        sender: 'admin',
        createdAt: now
      });
    } else {
      ticket.responses.push({
        message: `Ticket reassigned to ${admin.name}`,
        sender: 'admin',
        createdAt: new Date()
      });
    }

    // Save updated ticket
    await ticket.save();

    // Notify assigned admin via Socket.IO
    io.to(`admin-${admin._id}`).emit('ticket-assigned', {
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      priority: ticket.priority,
      category: ticket.category,
      assignedBy: req.user.name
    });

    res.status(200).json({
      success: true,
      data: {
        id: ticket._id,
        assignedTo: ticket.assignedTo,
        message: `Ticket successfully assigned to ${admin.name}`
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Add response to a ticket
 * @route POST /api/v2/admin/support/tickets/:id/responses
 * @access Private (Admin, Support role)
 */
export const addResponse = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { message } = req.body;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return next(new AppError('Invalid ticket ID format', 400));
    }

    // Find the ticket
    const ticket = await AdminSupportTicket.findById(id);

    if (!ticket) {
      return next(new AppError('Ticket not found', 404));
    }

    // Check access rights
    if (!req.user.isSuperAdmin && req.user.role !== 'Manager') {
      const isAssigned = ticket.assignedTo && ticket.assignedTo.id && 
                         ticket.assignedTo.id.toString() === req.user.id.toString();
      
      if (!isAssigned) {
        return next(new AppError('You do not have permission to respond to this ticket', 403));
      }
    }

    // Process file uploads if any
    const attachments = [];
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        try {
          const uploadedFile = await uploadFile(file);
          attachments.push({
            name: file.originalname,
            url: uploadedFile.url,
            type: file.mimetype,
            size: file.size
          });
        } catch (error) {
          logger.error(`File upload error: ${error.message}`);
          // Continue with other files even if one fails
        }
      }
    }

    // Create response
    const response = {
      message,
      sender: 'admin',
      attachments,
      createdAt: new Date()
    };

    // If first response, record time
    if (ticket.responses.length === 0) {
      const createdAt = new Date(ticket.createdAt);
      const now = new Date();
      const diffInMilliseconds = now - createdAt;
      ticket.firstResponseTime = Math.floor(diffInMilliseconds / (1000 * 60)); // Minutes
    }

    // Add response to ticket
    ticket.responses.push(response);

    // If ticket was new, move it to In Progress
    if (ticket.status === 'New') {
      ticket.status = 'In Progress';
    }

    // Save the updated ticket
    await ticket.save();

    // Notify customer about new response
    try {
      const customerEmail = ticket.customer.email;
      if (customerEmail) {
        await sendEmail({
          to: customerEmail,
          subject: `New Response to Your Ticket - ${ticket.ticketId}`,
          template: 'ticket-response',
          data: {
            name: ticket.customer.name || 'Valued Customer',
            ticketId: ticket.ticketId,
            subject: ticket.subject,
            message: message,
            respondent: req.user.name,
            hasAttachments: attachments.length > 0
          }
        });
      }
    } catch (emailError) {
      logger.error(`Error sending ticket response email: ${emailError.message}`);
      // Continue even if email fails
    }

    // Notify via Socket.IO
    io.to('admin-support').emit('ticket-response-added', {
      ticketId: ticket.ticketId,
      subject: ticket.subject,
      respondent: req.user.name,
      responseId: response._id
    });

    res.status(201).json({
      success: true,
      data: {
        id: ticket._id,
        responseId: ticket.responses[ticket.responses.length - 1]._id,
        message: 'Response added successfully'
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Get ticket statistics for dashboard
 * @route GET /api/v2/admin/support/stats
 * @access Private (Admin, Manager role)
 */
export const getTicketStats = async (req, res, next) => {
  try {
    // Get ticket counts by status
    const statusStats = await AdminSupportTicket.getTicketStats();

    // Get ticket stats by category
    const categoryStats = await AdminSupportTicket.getTicketStatsByCategory();

    // Get SLA breach statistics
    const slaBreachCount = await AdminSupportTicket.countDocuments({
      'sla.breached': true,
      status: { $nin: ['Resolved', 'Closed'] }
    });

    // Get unassigned ticket count
    const unassignedCount = await AdminSupportTicket.countDocuments({
      'assignedTo.id': { $exists: false }
    });

    // Calculate average resolution time
    const resolutionStats = await AdminSupportTicket.aggregate([
      {
        $match: {
          resolutionTime: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          avgResolutionTime: { $avg: '$resolutionTime' },
          minResolutionTime: { $min: '$resolutionTime' },
          maxResolutionTime: { $max: '$resolutionTime' }
        }
      }
    ]);

    // Calculate average first response time
    const responseTimeStats = await AdminSupportTicket.aggregate([
      {
        $match: {
          firstResponseTime: { $exists: true, $ne: null }
        }
      },
      {
        $group: {
          _id: null,
          avgResponseTime: { $avg: '$firstResponseTime' },
          minResponseTime: { $min: '$firstResponseTime' },
          maxResponseTime: { $max: '$firstResponseTime' }
        }
      }
    ]);

    // Get ticket trends
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    const dailyTickets = await AdminSupportTicket.aggregate([
      {
        $match: {
          createdAt: { $gte: thirtyDaysAgo, $lte: today }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { _id: 1 }
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        statusStats,
        categoryStats,
        slaBreachCount,
        unassignedCount,
        resolutionStats: resolutionStats[0] || {
          avgResolutionTime: 0,
          minResolutionTime: 0,
          maxResolutionTime: 0
        },
        responseTimeStats: responseTimeStats[0] || {
          avgResponseTime: 0,
          minResponseTime: 0,
          maxResponseTime: 0
        },
        dailyTickets
      }
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Export tickets to CSV or Excel
 * @route GET /api/v2/admin/support/tickets/export
 * @access Private (Admin, Manager role)
 */
export const exportTickets = async (req, res, next) => {
  try {
    const { format = 'csv', dateFrom, dateTo, status, category, priority } = req.query;

    // Build filter
    const filter = {};
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59, 999);
        filter.createdAt.$lte = toDate;
      }
    }
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (priority) filter.priority = priority;

    // Fetch tickets
    const tickets = await AdminSupportTicket.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    if (tickets.length === 0) {
      return next(new AppError('No tickets found with the specified criteria', 404));
    }

    // Prepare data for export
    const exportData = tickets.map(ticket => ({
      TicketID: ticket.ticketId,
      Subject: ticket.subject,
      Category: ticket.category,
      Priority: ticket.priority,
      Status: ticket.status,
      CustomerName: ticket.customer.name,
      CustomerType: ticket.customer.type,
      CustomerEmail: ticket.customer.email,
      CustomerPhone: ticket.customer.phone,
      AssignedTo: ticket.assignedTo ? ticket.assignedTo.name : 'Unassigned',
      CreatedAt: new Date(ticket.createdAt).toISOString(),
      UpdatedAt: new Date(ticket.updatedAt).toISOString(),
      ResponseCount: ticket.responses ? ticket.responses.length : 0,
      FirstResponseTime: ticket.firstResponseTime ? `${ticket.firstResponseTime} minutes` : 'N/A',
      ResolutionTime: ticket.resolutionTime ? `${ticket.resolutionTime} minutes` : 'N/A',
      SLABreached: ticket.sla && ticket.sla.breached ? 'Yes' : 'No'
    }));

    // Generate filename
    const date = new Date().toISOString().split('T')[0];
    const filename = `tickets_export_${date}.${format === 'excel' ? 'xlsx' : 'csv'}`;
    const filepath = path.join(__dirname, '../../../../temp', filename);

    // Ensure temp directory exists
    const tempDir = path.join(__dirname, '../../../../temp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Generate file based on format
    if (format === 'excel') {
      const xlsx = require('xlsx');
      const workbook = xlsx.utils.book_new();
      const worksheet = xlsx.utils.json_to_sheet(exportData);
      xlsx.utils.book_append_sheet(workbook, worksheet, 'Tickets');
      xlsx.writeFile(workbook, filepath);
    } else {
      // Default to CSV
      const csvStream = fs.createWriteStream(filepath);
      const csvWriter = csv.format({ headers: true });
      csvWriter.pipe(csvStream);
      exportData.forEach(row => csvWriter.write(row));
      csvWriter.end();
      
      // Wait for the stream to finish
      await new Promise((resolve) => {
        csvStream.on('finish', resolve);
      });
    }

    // Send the file
    res.download(filepath, filename, (err) => {
      if (err) {
        logger.error(`Error downloading exported tickets: ${err.message}`);
        return next(new AppError('Error downloading the file', 500));
      }
      
      // Clean up temp file after download
      fs.unlink(filepath, (unlinkErr) => {
        if (unlinkErr) {
          logger.error(`Error deleting temp file: ${unlinkErr.message}`);
        }
      });
    });
  } catch (error) {
    next(new AppError(error.message, 400));
  }
};

/**
 * Helper function to calculate SLA due date based on ticket category and priority
 */
const calculateSLA = (category, priority) => {
  let hoursToResolve = 24; // Default: 1 day

  // Adjust based on priority
  switch (priority) {
    case 'Low':
      hoursToResolve = 72; // 3 days
      break;
    case 'Medium':
      hoursToResolve = 48; // 2 days
      break;
    case 'High':
      hoursToResolve = 24; // 1 day
      break;
    case 'Urgent':
      hoursToResolve = 4; // 4 hours
      break;
  }

  // Further adjust based on category
  switch (category) {
    case 'ORDER':
    case 'PICKUP':
      if (priority === 'Urgent') hoursToResolve = 2; // More urgent handling
      break;
    case 'TECH':
      hoursToResolve += 24; // Allow more time for tech issues
      break;
    case 'CALLBACK':
      hoursToResolve = Math.min(hoursToResolve, 4); // Ensure quick callback
      break;
  }

  // Calculate due date
  const dueDate = new Date();
  dueDate.setHours(dueDate.getHours() + hoursToResolve);

  return {
    dueDate,
    breached: false
  };
}; 