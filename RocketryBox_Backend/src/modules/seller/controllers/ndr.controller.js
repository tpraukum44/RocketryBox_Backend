import NDR from '../models/ndr.model.js';
import { AppError } from '../../../middleware/errorHandler.js';

// List NDRs with filters and pagination
export const listNDRs = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status, courier, search, startDate, endDate, sortBy = 'createdAt', sortOrder = 'desc' } = req.query;
    const query = {};
    if (status) query.status = status;
    if (courier) query['courier.name'] = courier;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }
    if (search) {
      query.$or = [
        { awb: { $regex: search, $options: 'i' } },
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.phone': { $regex: search, $options: 'i' } }
      ];
    }
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    const ndrs = await NDR.find(query)
      .sort(sort)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    const total = await NDR.countDocuments(query);
    res.status(200).json({
      success: true,
      data: ndrs,
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

// Get NDR details
export const getNDR = async (req, res, next) => {
  try {
    const ndr = await NDR.findById(req.params.id);
    if (!ndr) throw new AppError('NDR not found', 404);
    res.status(200).json({ success: true, data: ndr });
  } catch (error) {
    next(error);
  }
};

// Update NDR status
export const updateNDRStatus = async (req, res, next) => {
  try {
    const { status, reason, recommendedAction, agentRemarks } = req.body;
    if (!status) throw new AppError('Status is required', 400);
    const ndr = await NDR.findById(req.params.id);
    if (!ndr) throw new AppError('NDR not found', 404);
    ndr.status = status;
    if (reason) ndr.reason = reason;
    if (recommendedAction) ndr.recommendedAction = recommendedAction;
    if (agentRemarks) {
      ndr.attemptHistory.push({
        date: new Date().toISOString().slice(0, 10),
        time: new Date().toISOString().slice(11, 19),
        status,
        reason: reason || '',
        agentRemarks
      });
    }
    ndr.updatedAt = new Date();
    await ndr.save();
    res.status(200).json({ success: true, data: ndr });
  } catch (error) {
    next(error);
  }
};

// Create NDR (for manual creation/testing)
export const createNDR = async (req, res, next) => {
  try {
    const ndr = new NDR(req.body);
    await ndr.save();
    res.status(201).json({ success: true, data: ndr });
  } catch (error) {
    next(error);
  }
}; 