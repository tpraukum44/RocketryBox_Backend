import WhatsAppSettings from '../models/whatsappSettings.model.js';
import { AppError } from '../../../middleware/errorHandler.js';

// Get WhatsApp settings for the seller
export const getWhatsAppSettings = async (req, res, next) => {
  try {
    const settings = await WhatsAppSettings.findOne({ seller: req.user.id });
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// Update WhatsApp settings for the seller
export const updateWhatsAppSettings = async (req, res, next) => {
  try {
    const { apiKey, apiSecret, senderNumber, templates, enabled } = req.body;
    let settings = await WhatsAppSettings.findOne({ seller: req.user.id });
    if (!settings) {
      settings = await WhatsAppSettings.create({
        seller: req.user.id,
        apiKey,
        apiSecret,
        senderNumber,
        templates: templates || {},
        enabled: enabled ?? false,
      });
    } else {
      if (apiKey) settings.apiKey = apiKey;
      if (apiSecret) settings.apiSecret = apiSecret;
      if (senderNumber) settings.senderNumber = senderNumber;
      if (templates) settings.templates = templates;
      if (enabled !== undefined) settings.enabled = enabled;
      await settings.save();
    }
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
};

// Enable/disable WhatsApp notifications
export const setWhatsAppEnabled = async (req, res, next) => {
  try {
    const { enabled } = req.body;
    let settings = await WhatsAppSettings.findOne({ seller: req.user.id });
    if (!settings) throw new AppError('WhatsApp settings not found', 404);
    settings.enabled = enabled;
    await settings.save();
    res.status(200).json({ success: true, data: settings });
  } catch (error) {
    next(error);
  }
}; 