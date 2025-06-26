import LabelSetting from '../models/labelSetting.model.js';
import { AppError } from '../../../middleware/errorHandler.js';

// Get label settings for seller
export const getLabelSetting = async (req, res, next) => {
  try {
    let setting = await LabelSetting.findOne({ seller: req.user.id });
    if (!setting) {
      // Return defaults if not set
      setting = await LabelSetting.create({ seller: req.user.id });
    }
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
};

// Update label settings for seller
export const updateLabelSetting = async (req, res, next) => {
  try {
    let setting = await LabelSetting.findOne({ seller: req.user.id });
    if (!setting) {
      setting = await LabelSetting.create({ seller: req.user.id });
    }
    const { labelSize, format, showLogo, logoUrl, showBarcode, showReturnLabel, additionalText } = req.body;
    if (labelSize) setting.labelSize = labelSize;
    if (format) setting.format = format;
    if (typeof showLogo !== 'undefined') setting.showLogo = showLogo;
    if (logoUrl) setting.logoUrl = logoUrl;
    if (typeof showBarcode !== 'undefined') setting.showBarcode = showBarcode;
    if (typeof showReturnLabel !== 'undefined') setting.showReturnLabel = showReturnLabel;
    if (typeof additionalText !== 'undefined') setting.additionalText = additionalText;
    await setting.save();
    res.status(200).json({ success: true, data: setting });
  } catch (error) {
    next(error);
  }
}; 