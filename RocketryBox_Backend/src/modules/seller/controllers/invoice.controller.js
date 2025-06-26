import Invoice from '../models/invoice.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import xlsx from 'xlsx';
import PDFDocument from 'pdfkit';
import { sendEmail } from '../../../utils/email.js';
import { sendSMS } from '../../../utils/sms.js';
import { createPaymentOrder, verifyPayment } from '../../../utils/payment.js';

// Create new invoice
export const createInvoice = async (req, res, next) => {
  try {
    const { items, dueDate, tax, remarks } = req.body;
    
    // Calculate totals
    const itemsWithTotals = items.map(item => ({
      ...item,
      total: item.quantity * item.unitPrice
    }));
    
    const itemsTotal = itemsWithTotals.reduce((sum, item) => sum + item.total, 0);
    const total = itemsTotal + (tax || 0);

    const invoice = await Invoice.create({
      seller: req.user.id,
      items: itemsWithTotals,
      dueDate,
      tax,
      total,
      amount: total,
      remarks
    });

    // Send notification
    await sendEmail({
      to: req.user.email,
      subject: 'New Invoice Created',
      template: 'invoice-created',
      data: { invoice }
    });

    res.status(201).json({
      success: true,
      data: invoice
    });
  } catch (error) {
    next(error);
  }
};

// Update invoice
export const updateInvoice = async (req, res, next) => {
  try {
    const { items, dueDate, tax, remarks, status } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, seller: req.user.id });
    
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status === 'paid') throw new AppError('Cannot update paid invoice', 400);
    
    const updates = {};
    if (items) {
      const itemsWithTotals = items.map(item => ({
        ...item,
        total: item.quantity * item.unitPrice
      }));
      updates.items = itemsWithTotals;
    }
    if (dueDate) updates.dueDate = dueDate;
    if (tax !== undefined) updates.tax = tax;
    if (remarks) updates.remarks = remarks;
    if (status) updates.status = status;

    const updatedInvoice = await Invoice.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    res.status(200).json({
      success: true,
      data: updatedInvoice
    });
  } catch (error) {
    next(error);
  }
};

// Delete invoice (soft delete)
export const deleteInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, seller: req.user.id });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status === 'paid') throw new AppError('Cannot delete paid invoice', 400);

    invoice.isDeleted = true;
    await invoice.save();

    res.status(200).json({
      success: true,
      message: 'Invoice deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

// Generate PDF
export const generatePDF = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, seller: req.user.id });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const doc = new PDFDocument();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=invoice-${invoice.invoiceNumber}.pdf`);
    doc.pipe(res);

    // Add content to PDF
    doc.fontSize(25).text('INVOICE', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Invoice Number: ${invoice.invoiceNumber}`);
    doc.text(`Date: ${invoice.date.toLocaleDateString()}`);
    doc.text(`Due Date: ${invoice.dueDate.toLocaleDateString()}`);
    doc.moveDown();

    // Add items table
    doc.text('Items:', { underline: true });
    invoice.items.forEach(item => {
      doc.text(`${item.description} - ${item.quantity} x ${item.unitPrice} = ${item.total}`);
    });
    doc.moveDown();

    // Add totals
    doc.text(`Subtotal: ${invoice.amount}`);
    doc.text(`Tax: ${invoice.tax}`);
    doc.text(`Total: ${invoice.total}`, { underline: true });

    doc.end();
  } catch (error) {
    next(error);
  }
};

// Initiate payment
export const initiateInvoicePayment = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, seller: req.user.id });
    if (!invoice) throw new AppError('Invoice not found', 404);
    if (invoice.status === 'paid') throw new AppError('Invoice already paid', 400);

    const payment = await createPaymentOrder({
      amount: invoice.total,
      currency: 'INR',
      awbNumber: invoice.invoiceNumber,
      paymentMethod: 'RAZORPAY'
    });

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    next(error);
  }
};

// Verify payment
export const verifyInvoicePayment = async (req, res, next) => {
  try {
    const { paymentId, orderId, signature } = req.body;
    const invoice = await Invoice.findOne({ _id: req.params.id, seller: req.user.id });
    if (!invoice) throw new AppError('Invoice not found', 404);

    const payment = await verifyPayment(paymentId, orderId, signature);
    if (payment.status === 'captured') {
      invoice.status = 'paid';
      invoice.paymentReference = paymentId;
      invoice.paymentDate = new Date();
      await invoice.save();

      // Send payment confirmation
      await sendEmail({
        to: req.user.email,
        subject: 'Payment Confirmation',
        template: 'payment-confirmation',
        data: { invoice, payment }
      });

      await sendSMS({
        to: req.user.phone,
        message: `Payment of ${invoice.total} for invoice ${invoice.invoiceNumber} has been confirmed.`
      });
    }

    res.status(200).json({
      success: true,
      data: { invoice, payment }
    });
  } catch (error) {
    next(error);
  }
};

// List invoices with filters and pagination
export const listInvoices = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, startDate, endDate, search, sortBy = 'date', sortOrder = 'desc' } = req.query;
    const query = { seller: req.user.id, isDeleted: false };
    
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { invoiceNumber: { $regex: search, $options: 'i' } },
        { remarks: { $regex: search, $options: 'i' } }
      ];
    }

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const invoices = await Invoice.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Invoice.countDocuments(query);

    res.status(200).json({
      success: true,
      data: invoices,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Get invoice details
export const getInvoice = async (req, res, next) => {
  try {
    const invoice = await Invoice.findOne({ _id: req.params.id, seller: req.user.id, isDeleted: false });
    if (!invoice) throw new AppError('Invoice not found', 404);
    res.status(200).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
};

// Export invoices (CSV/XLSX)
export const exportInvoices = async (req, res, next) => {
  try {
    const { status, startDate, endDate } = req.query;
    const query = { seller: req.user.id, isDeleted: false };
    
    if (status) query.status = status;
    if (startDate || endDate) {
      query.date = {};
      if (startDate) query.date.$gte = new Date(startDate);
      if (endDate) query.date.$lte = new Date(endDate);
    }

    const invoices = await Invoice.find(query).lean();
    const excelData = invoices.map(inv => ({
      'Invoice Number': inv.invoiceNumber,
      'Date': inv.date ? new Date(inv.date).toISOString().split('T')[0] : '',
      'Amount': inv.amount,
      'Status': inv.status,
      'Due Date': inv.dueDate ? new Date(inv.dueDate).toISOString().split('T')[0] : '',
      'Tax': inv.tax,
      'Total': inv.total,
      'Payment Reference': inv.paymentReference,
      'Payment Method': inv.paymentMethod,
      'Payment Date': inv.paymentDate ? new Date(inv.paymentDate).toISOString().split('T')[0] : '',
      'Remarks': inv.remarks
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(excelData);
    xlsx.utils.book_append_sheet(wb, ws, 'Invoices');
    const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=invoices.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    next(error);
  }
}; 