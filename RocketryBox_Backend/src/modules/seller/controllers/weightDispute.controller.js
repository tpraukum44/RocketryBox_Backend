import WeightDispute from '../models/weightDispute.model.js';
import SellerShipment from '../models/shipment.model.js';
import xlsx from 'xlsx';
import { AppError } from '../../../middleware/errorHandler.js';

// List weight disputes
export const listWeightDisputes = async (req, res, next) => {
  try {
    const {
      fromDate,
      toDate,
      status,
      accepted,
      search,
      awbNumber,
      product,
      courierPartner,
      page = 1,
      limit = 20
    } = req.query;

    const query = { seller: req.user.id };
    if (fromDate || toDate) {
      query.createdAt = {};
      if (fromDate) query.createdAt.$gte = new Date(fromDate);
      if (toDate) query.createdAt.$lte = new Date(toDate);
    }
    if (status) query.status = status;
    if (typeof accepted !== 'undefined') query.accepted = accepted === 'true';
    if (awbNumber) query.awbNumber = awbNumber;
    if (product) query.product = { $regex: product, $options: 'i' };
    if (courierPartner) query.courierPartner = courierPartner;
    if (search) {
      query.$or = [
        { awbNumber: { $regex: search, $options: 'i' } },
        { orderId: { $regex: search, $options: 'i' } },
        { product: { $regex: search, $options: 'i' } }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [disputes, total] = await Promise.all([
      WeightDispute.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      WeightDispute.countDocuments(query)
    ]);

    res.status(200).json({
      success: true,
      data: {
        disputes,
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

// Get weight dispute details
export const getWeightDisputeDetails = async (req, res, next) => {
  try {
    const { awbNumber } = req.params;
    const { orderId } = req.query;
    const dispute = await WeightDispute.findOne({
      awbNumber,
      orderId,
      seller: req.user.id
    });
    if (!dispute) throw new AppError('Dispute not found', 404);
    res.status(200).json({ success: true, data: dispute });
  } catch (error) {
    next(error);
  }
};

// Update weight dispute
export const updateWeightDispute = async (req, res, next) => {
  try {
    const { awbNumber } = req.params;
    const { orderId } = req.query;
    const { status, revised, accepted, comments } = req.body;
    const dispute = await WeightDispute.findOne({
      awbNumber,
      orderId,
      seller: req.user.id
    });
    if (!dispute) throw new AppError('Dispute not found', 404);
    if (status) dispute.status = status;
    if (typeof revised !== 'undefined') dispute.revised = revised;
    if (typeof accepted !== 'undefined') dispute.accepted = accepted;
    if (typeof comments !== 'undefined') dispute.comments = comments;
    await dispute.save();
    res.status(200).json({ success: true, data: { dispute } });
  } catch (error) {
    next(error);
  }
};

// Upload weight dispute file (Excel)
export const uploadWeightDisputeFile = async (req, res, next) => {
  try {
    if (!req.file) throw new AppError('No file uploaded', 400);
    const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);
    let successCount = 0, errorCount = 0;
    for (const row of rows) {
      try {
        // Required fields: awbNumber, orderId, given, applied, difference, status
        if (!row.awbNumber || !row.orderId || typeof row.given !== 'number' || typeof row.applied !== 'number' || typeof row.difference !== 'number' || !row.status) {
          errorCount++;
          continue;
        }
        await WeightDispute.create({
          shipment: row.shipmentId,
          awbNumber: row.awbNumber,
          orderId: row.orderId,
          given: row.given,
          applied: row.applied,
          revised: row.revised,
          difference: row.difference,
          accepted: row.accepted,
          product: row.product,
          comments: row.comments,
          status: row.status,
          courierPartner: row.courierPartner,
          seller: req.user.id
        });
        successCount++;
      } catch (e) {
        errorCount++;
      }
    }
    res.status(200).json({
      success: true,
      data: {
        message: 'File processed',
        totalDisputes: rows.length,
        successCount,
        errorCount
      }
    });
  } catch (error) {
    next(error);
  }
}; 