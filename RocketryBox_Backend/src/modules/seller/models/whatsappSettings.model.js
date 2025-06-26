import mongoose from 'mongoose';

const whatsappSettingsSchema = new mongoose.Schema({
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller', required: true, unique: true },
  apiKey: { type: String, required: true },
  apiSecret: { type: String, required: true },
  senderNumber: { type: String, required: true },
  templates: { type: Object, default: {} }, // e.g., { orderPlaced: 'templateId1', shipped: 'templateId2' }
  enabled: { type: Boolean, default: false },
}, { timestamps: true });

export default mongoose.model('WhatsAppSettings', whatsappSettingsSchema); 