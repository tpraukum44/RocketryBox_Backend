import CourierSetting from '../models/courierSetting.model.js';
import { AppError } from '../../../middleware/errorHandler.js';

// List courier settings
export const listCourierSettings = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, search, isActive } = req.query;
    const query = { seller: req.user.id };
    if (typeof isActive !== 'undefined') query.isActive = isActive === 'true';
    if (search) {
      query.courierName = { $regex: search, $options: 'i' };
    }
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [settings, total] = await Promise.all([
      CourierSetting.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      CourierSetting.countDocuments(query)
    ]);
    res.status(200).json({
      success: true,
      data: {
        settings,
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    next(error);
  }
};

// Add or update courier setting (upsert by courierName)
export const addOrUpdateCourierSetting = async (req, res, next) => {
  try {
    const { courierName, accountId, apiKey, apiSecret, pickupLocation, serviceablePincodes, maxWeight, maxValue, isActive } = req.body;
    let setting = await CourierSetting.findOne({ seller: req.user.id, courierName });
    if (setting) {
      // Update
      if (accountId) setting.accountId = accountId;
      if (apiKey) setting.apiKey = apiKey;
      if (apiSecret) setting.apiSecret = apiSecret;
      if (pickupLocation) setting.pickupLocation = pickupLocation;
      if (serviceablePincodes) setting.serviceablePincodes = serviceablePincodes;
      if (typeof maxWeight !== 'undefined') setting.maxWeight = maxWeight;
      if (typeof maxValue !== 'undefined') setting.maxValue = maxValue;
      if (typeof isActive !== 'undefined') setting.isActive = isActive;
      await setting.save();
    } else {
      // Create
      setting = await CourierSetting.create({
        seller: req.user.id,
        courierName,
        accountId,
        apiKey,
        apiSecret,
        pickupLocation,
        serviceablePincodes,
        maxWeight,
        maxValue,
        isActive
      });
    }
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

// Get courier setting details
export const getCourierSetting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const setting = await CourierSetting.findOne({ _id: id, seller: req.user.id });
    if (!setting) throw new AppError('Courier setting not found', 404);
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

// Delete courier setting
export const deleteCourierSetting = async (req, res, next) => {
  try {
    const { id } = req.params;
    const setting = await CourierSetting.findOneAndDelete({ _id: id, seller: req.user.id });
    if (!setting) throw new AppError('Courier setting not found', 404);
    res.status(200).json({ success: true, data: { message: 'Courier setting deleted' } });
  } catch (error) {
    next(error);
  }
}; 