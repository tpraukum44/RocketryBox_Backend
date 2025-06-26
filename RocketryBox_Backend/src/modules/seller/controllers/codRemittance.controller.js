import { AppError } from '../../../middleware/errorHandler.js';
import CODRemittance from '../models/codRemittance.model.js';
import Ledger from '../models/ledger.model.js';
import Seller from '../models/seller.model.js';

// Seller: List COD Remittances
export const listCODRemittances = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, start_date, end_date } = req.query;
    const query = { seller: req.user.id };
    if (status) query.status = status;
    if (start_date || end_date) {
      query.createdAt = {};
      if (start_date) query.createdAt.$gte = new Date(start_date);
      if (end_date) query.createdAt.$lte = new Date(end_date);
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [remittances, total] = await Promise.all([
      CODRemittance.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CODRemittance.countDocuments(query)
    ]);

    // Transform data to match frontend expectations
    const formattedRemittances = remittances.map(r => ({
      remittanceId: r.remittanceId || r._id.toString(),
      status: r.status || 'Pending',
      paymentDate: r.paymentDate ? new Date(r.paymentDate).toLocaleDateString() : new Date(r.createdAt).toLocaleDateString(),
      remittanceAmount: `₹${parseFloat(r.remittanceAmount || 0).toFixed(2)}`,
      freightDeduction: `₹${parseFloat(r.freightDeduction || 0).toFixed(2)}`,
      convenienceFee: `₹${parseFloat(r.convenienceFee || 0).toFixed(2)}`,
      total: `₹${parseFloat(r.total || 0).toFixed(2)}`,
      paymentRef: r.paymentRef || 'N/A'
    }));

    res.status(200).json({
      success: true,
      data: {
        remittances: formattedRemittances,
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

// Seller: Get COD Remittance Details
export const getCODRemittanceDetails = async (req, res, next) => {
  try {
    const { id } = req.params;
    const remittance = await CODRemittance.findOne({ _id: id, seller: req.user.id });
    if (!remittance) throw new AppError('Remittance not found', 404);
    res.status(200).json({ success: true, data: remittance });
  } catch (error) {
    next(error);
  }
};

// Admin: Create/Push COD Remittance
export const createCODRemittance = async (req, res, next) => {
  try {
    const { seller, remittanceAmount, freightDeduction, convenienceFee, total, paymentDate, paymentRef, status, remarks } = req.body;
    const remittance = await CODRemittance.create({
      seller,
      remittanceAmount,
      freightDeduction,
      convenienceFee,
      total,
      paymentDate,
      paymentRef,
      status: status || 'Pending',
      pushedBy: req.user.id,
      remarks
    });
    res.status(201).json({ success: true, data: remittance });
  } catch (error) {
    next(error);
  }
};

// Admin: Update COD Remittance
export const updateCODRemittance = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, paymentDate, paymentRef, remarks } = req.body;
    const remittance = await CODRemittance.findById(id);
    if (!remittance) throw new AppError('Remittance not found', 404);
    const prevStatus = remittance.status;
    if (status) remittance.status = status;
    if (paymentDate) remittance.paymentDate = paymentDate;
    if (paymentRef) remittance.paymentRef = paymentRef;
    if (remarks) remittance.remarks = remarks;
    await remittance.save();

    // Wallet credit logic: only if status transitions to Completed
    if (status === 'Completed' && prevStatus !== 'Completed') {
      // Update seller wallet
      const seller = await Seller.findById(remittance.seller);
      if (!seller) throw new AppError('Seller not found', 404);
      const currentBalance = parseFloat(seller.walletBalance || '0');
      seller.walletBalance = (currentBalance + parseFloat(remittance.total)).toFixed(2);
      await seller.save();
      // Create ledger entry
      await Ledger.create({
        seller: seller._id,
        type: 'cod_credit',
        transactionBy: 'system',
        credit: remittance.total.toString(),
        debit: null,
        taxableAmount: null,
        igst: null,
        cgst: null,
        sgst: null,
        totalAmount: remittance.total.toString(),
        closingBalance: seller.walletBalance,
        transactionAgainst: remittance.remittanceId,
        remark: `COD Remittance: ${remittance.remittanceId}`,
        status: 'completed',
        metadata: {
          paymentRef: remittance.paymentRef || '',
          paymentDate: remittance.paymentDate || '',
          remittanceId: remittance.remittanceId
        }
      });
    }
    res.status(200).json({ success: true, data: remittance });
  } catch (error) {
    next(error);
  }
};

// Seller: Get COD Summary
export const getCODSummary = async (req, res, next) => {
  try {
    const sellerId = req.user.id;

    // Get all remittances for this seller
    const remittances = await CODRemittance.find({ seller: sellerId });

    // Calculate summary statistics
    const totalCOD = remittances.reduce((sum, r) => sum + parseFloat(r.remittanceAmount || 0), 0);
    const completedRemittances = remittances.filter(r => r.status === 'Completed');
    const remittedTillDate = completedRemittances.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);
    const pendingRemittances = remittances.filter(r => r.status === 'Pending');
    const totalRemittanceDue = pendingRemittances.reduce((sum, r) => sum + parseFloat(r.total || 0), 0);

    // Get last completed remittance
    const lastRemittance = completedRemittances
      .sort((a, b) => new Date(b.paymentDate || b.createdAt) - new Date(a.paymentDate || a.createdAt))[0];
    const lastRemittanceAmount = lastRemittance ? parseFloat(lastRemittance.total || 0) : 0;

    // Estimate next remittance (this could be enhanced with actual business logic)
    const nextRemittance = totalRemittanceDue > 0 ? 'Pending' : 'N/A';

    const summary = {
      totalCOD: `₹${totalCOD.toFixed(2)}`,
      remittedTillDate: `₹${remittedTillDate.toFixed(2)}`,
      lastRemittance: `₹${lastRemittanceAmount.toFixed(2)}`,
      totalRemittanceDue: `₹${totalRemittanceDue.toFixed(2)}`,
      nextRemittance
    };

    res.status(200).json({
      success: true,
      data: summary
    });
  } catch (error) {
    next(error);
  }
};
