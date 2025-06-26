import AdminWalletTransaction from '../models/wallet.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import { logger } from '../../../utils/logger.js';
import mongoose from 'mongoose';
import { generateCSV, generateXLSX } from '../../../utils/exportHelpers.js';

// Helper function to format wallet transaction for response
const formatWalletTransaction = (transaction) => {
  return {
    id: transaction._id,
    date: transaction.createdAt,
    referenceNumber: transaction.referenceNumber,
    orderId: transaction.orderId || '',
    type: transaction.type,
    amount: `₹${transaction.amount.toFixed(2)}`,
    codCharge: `₹${transaction.codCharge.toFixed(2)}`,
    igst: `₹${transaction.igst.toFixed(2)}`,
    subTotal: `₹${transaction.subTotal.toFixed(2)}`,
    closingBalance: `₹${transaction.closingBalance.toFixed(2)}`,
    remark: transaction.remark || ''
  };
};

// Get wallet transactions with pagination and filtering
export const getWalletTransactions = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      from, 
      to, 
      type, 
      orderId, 
      referenceNumber,
      remark,
      sellerId
    } = req.query;
    
    // Build filter query
    const query = {};
    
    if (sellerId) {
      query.sellerId = sellerId;
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
    
    if (type) {
      query.type = type;
    }
    
    if (orderId) {
      query.orderId = orderId;
    }
    
    if (referenceNumber) {
      query.referenceNumber = { $regex: referenceNumber, $options: 'i' };
    }
    
    if (remark) {
      query.remark = { $regex: remark, $options: 'i' };
    }
    
    // Get total count for pagination
    const total = await AdminWalletTransaction.countDocuments(query);
    
    // Get transactions with pagination
    const transactions = await AdminWalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .skip((parseInt(page) - 1) * parseInt(limit))
      .limit(parseInt(limit))
      .populate('sellerId', 'name email')
      .exec();
    
    // Format transactions for response
    const formattedTransactions = transactions.map(formatWalletTransaction);
    
    res.status(200).json({
      success: true,
      data: formattedTransactions,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    logger.error(`Error in getWalletTransactions: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Get wallet transaction by ID
export const getWalletTransactionById = async (req, res, next) => {
  try {
    const { transactionId } = req.params;
    
    // Validate transaction ID
    if (!mongoose.Types.ObjectId.isValid(transactionId)) {
      return next(new AppError('Invalid transaction ID', 400));
    }
    
    // Find transaction
    const transaction = await AdminWalletTransaction.findById(transactionId)
      .populate('sellerId', 'name email')
      .exec();
    
    if (!transaction) {
      return next(new AppError('Transaction not found', 404));
    }
    
    // Format transaction for response
    const formattedTransaction = formatWalletTransaction(transaction);
    
    res.status(200).json({
      success: true,
      data: formattedTransaction
    });
  } catch (error) {
    logger.error(`Error in getWalletTransactionById: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Add a new wallet transaction
export const addWalletTransaction = async (req, res, next) => {
  try {
    const {
      sellerId,
      referenceNumber,
      orderId,
      type,
      amount,
      codCharge,
      igst,
      remark
    } = req.body;
    
    // Calculate subtotal and closing balance
    const subTotal = Number(amount) + Number(codCharge || 0) + Number(igst || 0);
    
    // Get current balance
    const lastTransaction = await AdminWalletTransaction.findOne({ sellerId })
      .sort({ createdAt: -1 })
      .exec();
    
    const previousBalance = lastTransaction ? lastTransaction.closingBalance : 0;
    
    // Calculate new closing balance based on transaction type
    let closingBalance;
    if (type === 'Recharge' || type === 'COD Credit' || type === 'Refund') {
      closingBalance = previousBalance + subTotal;
    } else if (type === 'Debit') {
      closingBalance = previousBalance - subTotal;
    } else {
      return next(new AppError('Invalid transaction type', 400));
    }
    
    // Create new transaction
    const newTransaction = await AdminWalletTransaction.create({
      sellerId,
      referenceNumber,
      orderId,
      type,
      amount: Number(amount),
      codCharge: Number(codCharge || 0),
      igst: Number(igst || 0),
      subTotal,
      closingBalance,
      remark,
      createdBy: req.user.id,
      updatedBy: req.user.id
    });
    
    // Format transaction for response
    const formattedTransaction = formatWalletTransaction(newTransaction);
    
    res.status(201).json({
      success: true,
      data: formattedTransaction,
      message: 'Wallet transaction added successfully'
    });
  } catch (error) {
    logger.error(`Error in addWalletTransaction: ${error.message}`);
    next(new AppError(error.message, 500));
  }
};

// Export wallet transactions
export const exportWalletTransactions = async (req, res, next) => {
  try {
    const { 
      from, 
      to, 
      type, 
      orderId, 
      referenceNumber,
      remark,
      sellerId,
      format = 'csv'
    } = req.query;
    
    // Build filter query
    const query = {};
    
    if (sellerId) {
      query.sellerId = sellerId;
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
    
    if (type) {
      query.type = type;
    }
    
    if (orderId) {
      query.orderId = orderId;
    }
    
    if (referenceNumber) {
      query.referenceNumber = { $regex: referenceNumber, $options: 'i' };
    }
    
    if (remark) {
      query.remark = { $regex: remark, $options: 'i' };
    }
    
    // Get transactions
    const transactions = await AdminWalletTransaction.find(query)
      .sort({ createdAt: -1 })
      .populate('sellerId', 'name email')
      .exec();
    
    if (transactions.length === 0) {
      return next(new AppError('No transactions found for export', 404));
    }
    
    // Format data for export
    const exportData = transactions.map(transaction => ({
      'Date': new Date(transaction.createdAt).toLocaleDateString(),
      'Reference Number': transaction.referenceNumber,
      'Order ID': transaction.orderId || '',
      'Type': transaction.type,
      'Amount': transaction.amount.toFixed(2),
      'COD Charge': transaction.codCharge.toFixed(2),
      'IGST': transaction.igst.toFixed(2),
      'Sub Total': transaction.subTotal.toFixed(2),
      'Closing Balance': transaction.closingBalance.toFixed(2),
      'Remark': transaction.remark || ''
    }));
    
    // Generate export file
    let exportResult;
    if (format.toLowerCase() === 'xlsx') {
      exportResult = await generateXLSX(exportData, 'wallet_transactions');
    } else {
      exportResult = await generateCSV(exportData, 'wallet_transactions');
    }
    
    // Set response headers and send file
    res.setHeader('Content-Type', exportResult.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename=${exportResult.filename}`);
    res.status(200).send(exportResult.content);
  } catch (error) {
    logger.error(`Error in exportWalletTransactions: ${error.message}`);
    next(new AppError(error.message, 500));
  }
}; 