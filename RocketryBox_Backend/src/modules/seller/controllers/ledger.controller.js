import Ledger from '../models/ledger.model.js';
import { AppError } from '../../../middleware/errorHandler.js';
import xlsx from 'xlsx';

// List ledger entries with filters and pagination
export const listLedgerEntries = async (req, res, next) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      fromDate,
      toDate,
      transactionNumber,
      transactionBy,
      transactionType,
      transactionAgainst,
      creditDebit,
      amount,
      remark
    } = req.query;

    const query = { seller: req.user.id };
    
    if (fromDate || toDate) {
      query.date = {};
      if (fromDate) query.date.$gte = new Date(fromDate);
      if (toDate) query.date.$lte = new Date(toDate);
    }
    if (transactionNumber) query.transactionId = transactionNumber;
    if (transactionBy) query.transactionBy = transactionBy;
    if (transactionType) query.type = transactionType;
    if (transactionAgainst) query.transactionAgainst = transactionAgainst;
    if (amount) query.totalAmount = amount;
    if (remark) query.remark = { $regex: remark, $options: 'i' };

    if (creditDebit) {
      if (creditDebit === 'Credit') {
        query.credit = { $ne: null };
      } else if (creditDebit === 'Debit') {
        query.debit = { $ne: null };
      }
    }

    const entries = await Ledger.find(query)
      .sort({ date: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const total = await Ledger.countDocuments(query);

    // Calculate summary
    const summary = await Ledger.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRecharge: {
            $sum: {
              $cond: [{ $eq: ['$type', 'recharge'] }, { $toDouble: '$totalAmount' }, 0]
            }
          },
          totalDebit: {
            $sum: {
              $cond: [{ $ne: ['$debit', null] }, { $toDouble: '$debit' }, 0]
            }
          },
          totalCredit: {
            $sum: {
              $cond: [{ $ne: ['$credit', null] }, { $toDouble: '$credit' }, 0]
            }
          }
        }
      }
    ]);

    // Get closing balance
    const latestEntry = await Ledger.findOne({ seller: req.user.id })
      .sort({ date: -1 })
      .select('closingBalance');

    res.status(200).json({
      success: true,
      data: {
        transactions: entries,
        summary: {
          ...summary[0],
          closingBalance: latestEntry ? latestEntry.closingBalance : '0'
        },
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

// Get ledger entry details
export const getLedgerEntry = async (req, res, next) => {
  try {
    const entry = await Ledger.findOne({ 
      _id: req.params.id, 
      seller: req.user.id 
    });

    if (!entry) {
      throw new AppError('Ledger entry not found', 404);
    }

    res.status(200).json({
      success: true,
      data: entry
    });
  } catch (error) {
    next(error);
  }
};

// Reverse a transaction
export const reverseTransaction = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const entry = await Ledger.findOne({ 
      _id: req.params.id, 
      seller: req.user.id 
    });

    if (!entry) {
      throw new AppError('Ledger entry not found', 404);
    }

    if (entry.status === 'reversed') {
      throw new AppError('Transaction already reversed', 400);
    }

    const reversal = await entry.reverse(reason);

    res.status(200).json({
      success: true,
      data: reversal
    });
  } catch (error) {
    next(error);
  }
};

// Export ledger entries
export const exportLedgerEntries = async (req, res, next) => {
  try {
    const { type, status, startDate, endDate, tags } = req.query;
    const query = { seller: req.user.id };
    
    if (type) query.type = type;
    if (status) query.status = status;
    if (tags) query.tags = { $in: tags.split(',') };
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const entries = await Ledger.find(query)
      .sort({ createdAt: -1 })
      .populate('reversedTransaction', 'transactionId')
      .lean();

    const excelData = entries.map(entry => ({
      'Transaction ID': entry.transactionId,
      'Type': entry.type,
      'Amount': entry.amount,
      'Balance': entry.balance,
      'Status': entry.status,
      'Reference': entry.reference,
      'Description': entry.description,
      'Tags': entry.tags?.join(', ') || '',
      'Reversed Transaction': entry.reversedTransaction?.transactionId || '',
      'Reversal Reason': entry.reversalReason || '',
      'Date': entry.createdAt.toISOString().split('T')[0]
    }));

    const wb = xlsx.utils.book_new();
    const ws = xlsx.utils.json_to_sheet(excelData);
    xlsx.utils.book_append_sheet(wb, ws, 'Ledger Entries');
    const excelBuffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=ledger-entries.xlsx');
    res.send(excelBuffer);
  } catch (error) {
    next(error);
  }
};

// Get ledger summary
export const getLedgerSummary = async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'type' } = req.query;
    const query = { seller: req.user.id };
    
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Get type-wise summary
    const typeSummary = await Ledger.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
          avgAmount: { $avg: '$amount' }
        }
      }
    ]);

    // Get status-wise summary
    const statusSummary = await Ledger.aggregate([
      { $match: query },
      {
        $group: {
          _id: '$status',
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      }
    ]);

    // Get daily summary
    const dailySummary = await Ledger.aggregate([
      { $match: query },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          total: { $sum: '$amount' },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } },
      { $limit: 30 }
    ]);

    // Get current balance and trends
    const latestEntry = await Ledger.findOne({ seller: req.user.id })
      .sort({ createdAt: -1 })
      .select('balance');

    // Calculate 30-day trend
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const trend = await Ledger.aggregate([
      {
        $match: {
          ...query,
          createdAt: { $gte: thirtyDaysAgo }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          dailyTotal: { $sum: '$amount' }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        typeSummary,
        statusSummary,
        dailySummary,
        currentBalance: latestEntry ? latestEntry.balance : 0,
        trend
      }
    });
  } catch (error) {
    next(error);
  }
};

// Create ledger entry (internal use only)
export const createLedgerEntry = async (data) => {
  try {
    const entry = await Ledger.create(data);
    return entry;
  } catch (error) {
    throw new AppError('Failed to create ledger entry', 500);
  }
}; 