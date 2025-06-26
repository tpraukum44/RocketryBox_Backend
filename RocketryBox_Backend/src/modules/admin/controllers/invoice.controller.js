import AdminInvoice from '../models/invoice.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import mongoose from 'mongoose';
import { generateCSV, generateXLSX } from '../../../utils/exportHelpers.js';

// Helper function to format invoice for response
const formatInvoice = (invoice) => {
  return {
    id: invoice._id,
    invoiceNumber: invoice.invoiceNumber,
    date: invoice.createdAt,
    sellerId: invoice.sellerId._id || invoice.sellerId,
    sellerName: invoice.sellerName,
    amount: `₹${invoice.amount.toFixed(2)}`,
    status: invoice.status,
    dueDate: invoice.dueDate,
    items: invoice.items.map(item => ({
      description: item.description,
      quantity: item.quantity,
      unitPrice: `₹${item.unitPrice.toFixed(2)}`,
      total: `₹${item.total.toFixed(2)}`
    })),
    tax: `₹${invoice.tax.toFixed(2)}`,
    total: `₹${invoice.total.toFixed(2)}`,
    paymentReference: invoice.paymentReference || '',
    remarks: invoice.remarks || ''
  };
};

// Get invoices with pagination and filtering
export const getInvoices = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      sellerId, 
      status, 
      from, 
      to 
    } = req.query;
    
    // Build filter query
    const query = {};
    
    if (sellerId) {
      query.sellerId = sellerId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = new Date(from);
      }
      if (to) {
        query.createdAt.$lte = new Date(to);
      }
    }
    
    // Get total count for pagination
    const total = await AdminInvoice.countDocuments(query);
    
    // Get invoices with pagination
    const invoices = await AdminInvoice.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('sellerId', 'name email')
      .exec();
    
    // Format invoices for response
    const formattedInvoices = invoices.map(formatInvoice);
    
    res.status(200).json({
      success: true,
      data: formattedInvoices,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error in getInvoices: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get invoice by ID
export const getInvoiceById = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    
    // Validate invoice ID
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return next(new AppError('Invalid invoice ID', 400));
    }
    
    // Find invoice
    const invoice = await AdminInvoice.findById(invoiceId)
      .populate('sellerId', 'name email')
      .exec();
    
    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }
    
    // Format invoice for response
    const formattedInvoice = formatInvoice(invoice);
    
    res.status(200).json({
      success: true,
      data: formattedInvoice
    });
  } catch (error) {
    logger.error(`Error in getInvoiceById: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Create a new invoice
export const createInvoice = async (req, res, next) => {
  try {
    const {
      sellerId,
      sellerName,
      amount,
      dueDate,
      items,
      tax,
      total,
      paymentReference,
      remarks
    } = req.body;
    
    // Generate invoice number (you can customize this as needed)
    const invoiceCount = await AdminInvoice.countDocuments();
    const invoiceNumber = `INV-${new Date().getFullYear()}${(invoiceCount + 1).toString().padStart(4, '0')}`;
    
    // Calculate total if not provided
    let calculatedTotal = total;
    if (!calculatedTotal) {
      const itemsTotal = items.reduce((sum, item) => sum + (item.total || (item.quantity * item.unitPrice)), 0);
      calculatedTotal = itemsTotal + (tax || 0);
    }
    
    // Create new invoice
    const newInvoice = await AdminInvoice.create({
      invoiceNumber,
      sellerId,
      sellerName,
      amount,
      status: 'due',
      dueDate: new Date(dueDate),
      items,
      tax: tax || 0,
      total: calculatedTotal,
      paymentReference,
      remarks,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    // Format invoice for response
    const formattedInvoice = formatInvoice(newInvoice);
    
    res.status(201).json({
      success: true,
      data: formattedInvoice,
      message: 'Invoice created successfully'
    });
  } catch (error) {
    logger.error(`Error in createInvoice: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Update invoice status
export const updateInvoiceStatus = async (req, res, next) => {
  try {
    const { invoiceId } = req.params;
    const { status, paymentReference, remarks } = req.body;
    
    // Validate invoice ID
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      return next(new AppError('Invalid invoice ID', 400));
    }
    
    // Find and update invoice
    const invoice = await AdminInvoice.findByIdAndUpdate(
      invoiceId,
      {
        status,
        paymentReference,
        remarks,
        updatedBy: req.user.id
      },
      { new: true }
    ).populate('sellerId', 'name email');
    
    if (!invoice) {
      return next(new AppError('Invoice not found', 404));
    }
    
    // Format invoice for response
    const formattedInvoice = formatInvoice(invoice);
    
    res.status(200).json({
      success: true,
      data: formattedInvoice,
      message: 'Invoice status updated successfully'
    });
  } catch (error) {
    logger.error(`Error in updateInvoiceStatus: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Export invoices
export const exportInvoices = async (req, res, next) => {
  try {
    const { 
      sellerId, 
      status, 
      from, 
      to,
      format = 'csv'
    } = req.query;
    
    // Build filter query
    const query = {};
    
    if (sellerId) {
      query.sellerId = sellerId;
    }
    
    if (status) {
      query.status = status;
    }
    
    if (from || to) {
      query.createdAt = {};
      if (from) {
        query.createdAt.$gte = new Date(from);
      }
      if (to) {
        query.createdAt.$lte = new Date(to);
      }
    }
    
    // Get invoices
    const invoices = await AdminInvoice.find(query)
      .sort({ createdAt: -1 })
      .populate('sellerId', 'name email')
      .exec();
    
    if (invoices.length === 0) {
      return next(new AppError('No invoices found for export', 404));
    }
    
    // Format data for export
    const exportData = invoices.map(invoice => ({
      'Invoice Number': invoice.invoiceNumber,
      'Date': new Date(invoice.createdAt).toLocaleDateString(),
      'Seller ID': invoice.sellerId._id || invoice.sellerId,
      'Seller Name': invoice.sellerName,
      'Amount': invoice.amount.toFixed(2),
      'Status': invoice.status,
      'Due Date': new Date(invoice.dueDate).toLocaleDateString(),
      'Tax': invoice.tax.toFixed(2),
      'Total': invoice.total.toFixed(2),
      'Payment Reference': invoice.paymentReference || '',
      'Remarks': invoice.remarks || ''
    }));
    
    // Generate export file
    let exportResult;
    if (format.toLowerCase() === 'xlsx') {
      exportResult = await generateXLSX(exportData, 'invoices');
    } else {
      exportResult = await generateCSV(exportData, 'invoices');
    }
    
    // Set response headers and send file
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    res.status(200).send(exportResult.content);
  } catch (error) {
    logger.error(`Error in exportInvoices: ${error.message}`);
    next(new AppError(error.message, 500));
  }
}; 